import { useEffect, useRef, useState } from 'react';
import { identityApi } from '../services/identityApi';
import { trackingApi } from '../services/trackingApi';
import { useAuth } from '../hooks/authContext';
import { useGeolocation } from '../hooks/useGeolocation';

export default function Driver() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [sentAt, setSentAt] = useState(null);
  const [status, setStatus] = useState('Publishing is stopped.');
  const location = useGeolocation(publishing);
  const stopLocation = location.stop;
  const position = useRef(null);
  const publishCurrent = useRef(null);
  position.current = location.status === 'allowed' ? location.position : null;

  useEffect(() => {
    const controller = new AbortController();
    identityApi.assignedVehicles(token, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setVehicles(data.vehicles); setVehicleId(data.vehicles[0]?.vehicleId || ''); }
    }).catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    if (publishing && location.status === 'denied') { setPublishing(false); setError(location.message); }
  }, [publishing, location.status, location.message]);

  useEffect(() => {
    if (!publishing || !vehicleId) return;
    let active = true, busy = false, grant = null, lastAttempt = -Infinity;
    const controller = new AbortController();
    const publish = async () => {
      const fix = position.current;
      if (!active || busy) return;
      if (!fix || Date.now() - fix.timestamp > 20000 || fix.accuracy > 100) { setStatus('Waiting for a recent location fix with accuracy within 100 m.'); return; }
      if (Date.now() - lastAttempt < 5000) return;
      busy = true;
      lastAttempt = Date.now();
      try {
        if (!grant || grant.expiresAt < Date.now() + 15000) {
          const result = await identityApi.trackingToken(vehicleId, token, controller.signal);
          grant = { token: result.trackingToken, expiresAt: Date.now() + result.expiresIn * 1000 };
        }
        if (!active) return;
        const result = await trackingApi.publish(vehicleId, grant.token, fix, controller.signal);
        if (active) { setSentAt(result.receivedAt); setStatus('Publishing latest vehicle location every 5 seconds.'); setError(''); }
      } catch (failure) {
        if (!active || failure.name === 'AbortError') return;
        setError(failure.message);
        if ([401, 403, 404].includes(failure.status)) { setPublishing(false); stopLocation(); }
      } finally { busy = false; }
    };
    publishCurrent.current = publish;
    publish();
    const interval = setInterval(publish, 1000);
    return () => { active = false; controller.abort(); clearInterval(interval); grant = null; publishCurrent.current = null; };
  }, [publishing, vehicleId, token, stopLocation]);
  useEffect(() => {
    if (publishing && location.status === 'allowed') publishCurrent.current?.();
  }, [publishing, location.status, location.position]);

  const selected = vehicles.find((vehicle) => vehicle.vehicleId === vehicleId);
  return <main className="workspace-page"><span className="eyebrow">Assigned driver</span><h1>Publish vehicle location</h1>
    <p>Your location is uploaded only while publishing is enabled. The public map shows the assigned vehicle, coordinates and server update time. Redis keeps only its latest position for up to 120 seconds.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {!vehicles.length ? <p className="empty-state">No active assigned vehicle. Ask an administrator to assign your driver account.</p> : <section className="workspace-card">
      <label>Assigned vehicle<select value={vehicleId} disabled={publishing} onChange={(event) => { setVehicleId(event.target.value); setSentAt(null); }}>
        {vehicles.map((vehicle) => <option key={vehicle.vehicleId} value={vehicle.vehicleId}>{vehicle.displayName} ({vehicle.code}){vehicle.simulated ? ' · Simulated demo' : ''}</option>)}
      </select></label>
      {selected?.simulated && <p className="warning">This vehicle is labeled as a simulated demo on the public map.</p>}
      <p role="status">{publishing ? location.message : 'Browser location watch is stopped.'}</p>
      {publishing && location.position && <p className="muted">Approximate accuracy: ±{Math.round(location.position.accuracy)} m</p>}
      <p role="status">{publishing ? status : 'Publishing is stopped.'}{sentAt ? ` Last accepted: ${new Date(sentAt).toLocaleTimeString()}.` : ''}</p>
      {publishing ? <button className="danger" onClick={() => { setPublishing(false); location.stop(); }}>Stop publishing</button> : <button onClick={() => { setError(''); setPublishing(true); }}>Start publishing my location</button>}
    </section>}
  </main>;
}
