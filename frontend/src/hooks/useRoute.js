import { useCallback, useEffect, useRef, useState } from 'react';
import { routingApi } from '../services/routingApi';

export function useRoute() {
  const [state, setState] = useState({ route: null, loading: false, error: '' });
  const pending = useRef(null);
  const cancel = useCallback(() => { pending.current?.abort(); pending.current = null; }, []);
  useEffect(() => cancel, [cancel]);
  const calculate = useCallback(async (start, destination) => {
    cancel();
    const controller = new AbortController();
    pending.current = controller;
    setState({ route: null, loading: true, error: '' });
    try {
      const route = await routingApi.route(start, destination, controller.signal);
      if (controller.signal.aborted) return null;
      const coordinates = route.geometry?.coordinates;
      const validGeometry = Array.isArray(coordinates) && coordinates.length >= 2 && coordinates.every((point) => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
      const validInstructions = Array.isArray(route.instructions) && route.instructions.every((instruction) => typeof instruction.text === 'string' && Number.isFinite(instruction.point?.lat) && Number.isFinite(instruction.point?.lng));
      if (route.geometry?.type !== 'LineString' || !validGeometry || !validInstructions || !Number.isFinite(route.distanceMeters) || !Number.isFinite(route.durationSeconds)) throw new Error('The routing service returned an invalid route.');
      setState({ route, loading: false, error: '' });
      return route;
    } catch (error) {
      const temporaryFailure = ['ROUTING_TIMEOUT', 'ROUTING_ENGINE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code);
      if (!controller.signal.aborted) setState({ route: null, loading: false, error: temporaryFailure ? 'Routing is temporarily unavailable. Please try again.' : error.message });
      return null;
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [cancel]);
  const clear = useCallback(() => { cancel(); setState({ route: null, loading: false, error: '' }); }, [cancel]);
  return { ...state, calculate, clear };
}
