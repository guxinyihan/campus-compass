import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Driver from '../src/pages/Driver';
import { identityApi } from '../src/services/identityApi';
import { trackingApi } from '../src/services/trackingApi';
import { ApiError } from '../src/services/http';

vi.mock('../src/hooks/authContext', () => ({ useAuth: () => ({ token: 'access-token' }) }));
vi.mock('../src/services/identityApi', () => ({ identityApi: { assignedVehicles: vi.fn(), trackingToken: vi.fn() } }));
vi.mock('../src/services/trackingApi', () => ({ trackingApi: { publish: vi.fn() } }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function setup() {
  let sample;
  const geolocation = { watchPosition: vi.fn((callback) => { sample = callback; return 0; }), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  identityApi.assignedVehicles.mockResolvedValue({ vehicles: [{ vehicleId: 'demo-a', code: 'DEMO-A', displayName: 'Demo shuttle', simulated: true }] });
  identityApi.trackingToken.mockResolvedValue({ trackingToken: 'vehicle-grant', expiresIn: 120 });
  trackingApi.publish.mockResolvedValue({ vehicleId: 'demo-a', lat: 30.353, lng: 76.365, receivedAt: new Date().toISOString() });
  const view = render(<Driver />);
  await screen.findByRole('button', { name: 'Start publishing my location' });
  vi.useFakeTimers();
  return { geolocation, view, sample: () => sample({ coords: { latitude: 30.353, longitude: 76.365, accuracy: 10, heading: null }, timestamp: Date.now() }) };
}

test('driver publishing requires opt-in, gets an assigned grant, throttles writes and cleans up on stop', async () => {
  const { geolocation, view, sample } = await setup();
  expect(geolocation.watchPosition).not.toHaveBeenCalled();
  expect(trackingApi.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start publishing my location' }));
  act(sample);
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(identityApi.trackingToken).toHaveBeenCalledWith('demo-a', 'access-token', expect.any(AbortSignal));
  expect(trackingApi.publish).toHaveBeenCalledTimes(1);
  expect(trackingApi.publish.mock.calls[0][0]).toBe('demo-a');
  expect(trackingApi.publish.mock.calls[0][1]).toBe('vehicle-grant');
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(trackingApi.publish).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Stop publishing' }));
  expect(geolocation.clearWatch).toHaveBeenCalledWith(0);
  await act(async () => { vi.advanceTimersByTime(20000); });
  expect(trackingApi.publish).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('assignment rejection stops publishing and the location watch', async () => {
  const { geolocation, sample } = await setup();
  identityApi.trackingToken.mockRejectedValue(new ApiError('This vehicle is not assigned to you.', 'FORBIDDEN', 403));
  fireEvent.click(screen.getByRole('button', { name: 'Start publishing my location' }));
  act(sample);
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole('alert').textContent).toMatch(/not assigned/);
  expect(screen.getByRole('button', { name: 'Start publishing my location' })).toBeTruthy();
  expect(geolocation.clearWatch).toHaveBeenCalledWith(0);
  expect(trackingApi.publish).not.toHaveBeenCalled();
});
