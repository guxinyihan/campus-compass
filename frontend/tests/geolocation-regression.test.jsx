import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useGeolocation } from '../src/hooks/useGeolocation';

afterEach(() => vi.unstubAllGlobals());

test('GPS is opt-in; the only watch is released on mode changes and unmount, including id zero', () => {
  let sequence = 0;
  const geolocation = { watchPosition: vi.fn(() => sequence++), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  const { rerender, unmount } = renderHook(({ enabled }) => useGeolocation(enabled), { initialProps: { enabled: false } });
  expect(geolocation.watchPosition).not.toHaveBeenCalled();
  rerender({ enabled: true });
  expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  rerender({ enabled: false });
  expect(geolocation.clearWatch).toHaveBeenCalledWith(0);
  rerender({ enabled: true });
  unmount();
  expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
  expect(geolocation.clearWatch).toHaveBeenCalledTimes(2);
});

test.each([[1, 'denied'], [2, 'unavailable'], [3, 'timeout']])('permission error %i is inline state %s', (code, status) => {
  let reject;
  const geolocation = { watchPosition: vi.fn((success, failure) => { reject = failure; return 7; }), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  const { result, unmount } = renderHook(() => useGeolocation(true));
  act(() => reject({ code }));
  expect(result.current.status).toBe(status);
  expect(result.current.message.length).toBeGreaterThan(20);
  unmount();
  expect(geolocation.clearWatch).toHaveBeenCalledTimes(1);
});

test('unsupported browser has a manual-start message', () => {
  vi.stubGlobal('navigator', {});
  const { result } = renderHook(() => useGeolocation(true));
  expect(result.current.status).toBe('unsupported');
  expect(result.current.message).toMatch(/Choose a campus place/);
});

test('accuracy is preserved, retry releases the previous watch, and late callbacks are ignored', () => {
  const callbacks = [];
  const geolocation = { watchPosition: vi.fn((callback) => { callbacks.push(callback); return callbacks.length - 1; }), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  const { result, unmount } = renderHook(() => useGeolocation(true));
  act(() => callbacks[0]({ coords: { latitude: 30.35, longitude: 76.36, accuracy: 80 }, timestamp: 100 }));
  expect(result.current.position.accuracy).toBe(80);
  expect(result.current.message).toMatch(/accuracy is poor/);
  act(() => result.current.retry());
  expect(geolocation.clearWatch).toHaveBeenCalledWith(0);
  const before = result.current.position;
  act(() => callbacks[0]({ coords: { latitude: 0, longitude: 0, accuracy: 1 }, timestamp: 200 }));
  expect(result.current.position).toBe(before);
  unmount();
  expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
});
