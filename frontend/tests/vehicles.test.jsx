import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { freshness, useVehicles } from '../src/hooks/useVehicles';
import { trackingApi } from '../src/services/trackingApi';

vi.mock('../src/services/trackingApi', () => ({ trackingApi: { snapshot: vi.fn() } }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('real WebSocket messages update positions, reconcile late snapshots and age to offline without polling', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));
  let snapshot;
  trackingApi.snapshot.mockReturnValue(new Promise((resolve) => { snapshot = resolve; }));
  const sockets = [];
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; this.onclose?.(); }
  }
  vi.stubGlobal('WebSocket', Socket);
  const { result, unmount } = renderHook(() => useVehicles());
  expect(sockets[0].url).toBe('ws://localhost:3000/tracking/ws/vehicles');
  act(() => sockets[0].onopen());
  const latest = { type: 'vehicle.location', vehicleId: 'v1', lat: 30.355, lng: 76.36, receivedAt: '2026-10-04T00:00:00Z' };
  act(() => sockets[0].onmessage({ data: JSON.stringify(latest) }));
  await act(async () => snapshot({ vehicles: [{ ...latest, lat: 30.351, receivedAt: '2026-10-04T00:00:00.001Z' }], staleAfterSeconds: 30, ttlSeconds: 120 }));
  expect(result.current.positions.v1.lat).toBe(30.355);
  act(() => sockets[0].onmessage({ data: JSON.stringify({ ...latest, lat: 30.356 }) }));
  expect(result.current.positions.v1.lat).toBe(30.356);
  act(() => sockets[0].onmessage({ data: JSON.stringify({ ...latest, lat: 30.357, receivedAt: '2026-10-03T23:59:59.999Z' }) }));
  expect(result.current.positions.v1.lat).toBe(30.357);
  act(() => vi.advanceTimersByTime(30000));
  expect(freshness(result.current.positions.v1, result.current.now)).toBe('stale');
  act(() => vi.advanceTimersByTime(90000));
  expect(result.current.positions.v1).toBeUndefined();
  expect(trackingApi.snapshot).toHaveBeenCalledTimes(1);
  unmount();
  expect(sockets[0].closed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test('socket failures use bounded reconnection and cleanup cancels retries', async () => {
  vi.useFakeTimers();
  trackingApi.snapshot.mockResolvedValue({ vehicles: [] });
  const sockets = [];
  class Socket { constructor() { sockets.push(this); } close() { this.closed = true; } }
  vi.stubGlobal('WebSocket', Socket);
  const { result, unmount } = renderHook(() => useVehicles());
  await act(async () => {});
  act(() => sockets[0].onmessage({ data: JSON.stringify({ type: 'vehicle.location', vehicleId: 'old', lat: 30.35, lng: 76.36, receivedAt: new Date().toISOString() }) }));
  expect(result.current.positions.old).toBeTruthy();
  act(() => sockets[0].onclose());
  expect(result.current.connection).toBe('reconnecting');
  act(() => vi.advanceTimersByTime(2000));
  expect(sockets).toHaveLength(2);
  act(() => sockets[1].onmessage({ data: JSON.stringify({ type: 'vehicle.snapshot', vehicles: [], staleAfterSeconds: 30, ttlSeconds: 120 }) }));
  expect(result.current.positions).toEqual({});
  act(() => sockets[1].onclose());
  unmount();
  act(() => vi.advanceTimersByTime(60000));
  expect(sockets).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});
