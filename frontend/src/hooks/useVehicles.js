import { useEffect, useState } from 'react';
import { config, websocketUrl } from '../config';
import { trackingApi } from '../services/trackingApi';

export function mergePosition(previous, position, orderedEvent = false) {
  if (!position || typeof position.vehicleId !== 'string' || !Number.isFinite(position.lat) || !Number.isFinite(position.lng) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180 || !Number.isFinite(Date.parse(position.receivedAt))) return previous;
  const existing = previous[position.vehicleId];
  // Redis atomically writes and publishes. Its event arrival order is definitive;
  // concurrent request timestamps may be equal or inverted before that commit.
  if (!orderedEvent && existing && Date.parse(existing.receivedAt) >= Date.parse(position.receivedAt)) return previous;
  const safe = { vehicleId: position.vehicleId, lat: position.lat, lng: position.lng, receivedAt: position.receivedAt,
    ...(Number.isFinite(position.heading) ? { heading: position.heading } : {}), ...(Number.isFinite(position.accuracy) ? { accuracy: position.accuracy } : {}) };
  return { ...previous, [position.vehicleId]: safe };
}

export function freshness(position, now, staleSeconds = 30, ttlSeconds = 120) {
  if (!position) return 'offline';
  const age = Math.max(0, now - Date.parse(position.receivedAt));
  return age >= ttlSeconds * 1000 ? 'offline' : age >= staleSeconds * 1000 ? 'stale' : 'live';
}

export function useVehicles() {
  const [positions, setPositions] = useState({});
  const [connection, setConnection] = useState('connecting');
  const [policy, setPolicy] = useState({ staleAfterSeconds: 30, ttlSeconds: 120 });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let active = true, socket, retry, attempts = 0, wsSeen = false;
    const controller = new AbortController();
    const accept = (data, fromWebSocket = false) => {
      if (!active) return;
      if (!fromWebSocket && wsSeen) return;
      if (fromWebSocket && data.type === 'vehicle.location') {
        wsSeen = true;
        setPositions((previous) => mergePosition(previous, data, true));
      } else if (Array.isArray(data.vehicles) && (!fromWebSocket || data.type === 'vehicle.snapshot')) {
        if (fromWebSocket) wsSeen = true;
        // Every WS bootstrap is authoritative, including reconnects. A later
        // HTTP bootstrap cannot restore positions superseded by ordered events.
        setPositions(data.vehicles.reduce((state, point) => mergePosition(state, point, true), {}));
        if (Number.isFinite(data.staleAfterSeconds) && Number.isFinite(data.ttlSeconds)) setPolicy({ staleAfterSeconds: data.staleAfterSeconds, ttlSeconds: data.ttlSeconds });
      }
    };
    trackingApi.snapshot(controller.signal).then(accept).catch((error) => {
      if (active && error.name !== 'AbortError') setConnection('unavailable');
    });
    const connect = () => {
      if (!active) return;
      setConnection('connecting');
      socket = new WebSocket(websocketUrl(config.trackingWsUrl));
      socket.onopen = () => { if (active) { attempts = 0; setConnection('connected'); } };
      socket.onmessage = ({ data }) => { try { accept(JSON.parse(data), true); } catch { if (active) setConnection('invalid-update'); } };
      socket.onerror = () => { if (active) setConnection('unavailable'); };
      socket.onclose = () => {
        if (!active) return;
        setConnection('reconnecting');
        retry = setTimeout(connect, Math.min(30000, 2000 * 2 ** attempts++));
      };
    };
    connect();
    const clock = setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      setPositions((previous) => {
        const entries = Object.entries(previous).filter(([, position]) => timestamp - Date.parse(position.receivedAt) < 120000);
        return entries.length === Object.keys(previous).length ? previous : Object.fromEntries(entries);
      });
    }, 1000);
    return () => { active = false; controller.abort(); clearTimeout(retry); clearInterval(clock); socket?.close(); };
  }, []);
  return { positions, connection, now, ...policy };
}
