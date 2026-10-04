import { useCallback, useEffect, useRef, useState } from 'react';

const messages = {
  1: ['denied', 'Location permission was denied. Choose a campus place as your start, or change your browser permission.'],
  2: ['unavailable', 'Your position is temporarily unavailable. You can choose a campus place as your start.'],
  3: ['timeout', 'Location timed out. Retry or choose a campus place as your start.'],
};

export function useGeolocation(enabled) {
  const [state, setState] = useState({ status: 'prompt', position: null, message: 'Location is optional. Choose a campus start or enable your browser location.' });
  const watch = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const stop = useCallback(() => {
    if (watch.current !== null) {
      navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }
    if (!navigator.geolocation) {
      setState({ status: 'unsupported', position: null, message: 'This browser does not support location. Choose a campus place as your start.' });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, status: 'prompt', message: 'Waiting for browser location permission…' }));
    const id = navigator.geolocation.watchPosition((fix) => {
      if (!active) return;
      const { latitude: lat, longitude: lng, accuracy, heading } = fix.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy)) return;
      setState({ status: 'allowed', position: { lat, lng, accuracy, heading, timestamp: fix.timestamp }, message: accuracy > 50 ? 'Location accuracy is poor. Navigation progress is paused until a better fix.' : 'Your location is available.' });
    }, (error) => {
      if (!active) return;
      const [status, message] = messages[error.code] || messages[2];
      setState((s) => ({ ...s, status, message }));
      if (error.code === 1) { active = false; stop(); }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    watch.current = id;
    return () => { active = false; stop(); };
  }, [enabled, stop, attempt]);

  return { ...state, stop, retry };
}
