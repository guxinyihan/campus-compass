import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Navigate from '../src/pages/Navigate';
import { routingApi } from '../src/services/routingApi';
import { identityApi } from '../src/services/identityApi';

vi.mock('../src/map/CampusMap', () => ({ default: () => <div aria-label="Campus map" /> }));
vi.mock('../src/hooks/useVehicles', () => ({ useVehicles: () => ({ positions: {}, connection: 'connected', now: Date.now(), staleAfterSeconds: 30, ttlSeconds: 120 }), freshness: () => 'offline' }));
vi.mock('../src/services/routingApi', () => ({ routingApi: { campus: vi.fn(), pois: vi.fn(), route: vi.fn() } }));
vi.mock('../src/services/identityApi', () => ({ identityApi: { vehicles: vi.fn(), notices: vi.fn() } }));
const pois = [{ id: 'a', name: 'Main Gate', category: 'gate', lat: 30.354, lng: 76.361 }, { id: 'b', name: 'Library', category: 'library', lat: 30.355, lng: 76.362 }];
const route = { geometry: { type: 'LineString', coordinates: [[76.361, 30.354], [76.362, 30.355]] }, distanceMeters: 130, durationSeconds: 120,
  instructions: [{ text: 'Walk toward the library', point: pois[0], distanceMeters: 130 }, { text: 'Arrive at Library', point: pois[1], distanceMeters: 0 }] };

beforeEach(() => {
  routingApi.campus.mockResolvedValue({}); routingApi.pois.mockResolvedValue({ pois }); routingApi.route.mockResolvedValue(route);
  identityApi.vehicles.mockResolvedValue({ vehicles: [] }); identityApi.notices.mockResolvedValue({ notices: [] });
});
afterEach(() => vi.unstubAllGlobals());

async function choose(label, query, name) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: query } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
}

test('anonymous manual start works, local search fetches once, and the first received direction appears', async () => {
  const geolocation = { watchPosition: vi.fn(), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  render(<Navigate />);
  await choose('Start at a campus place', 'gate', 'Main Gate');
  await choose('Destination', 'lib', 'Library');
  expect(routingApi.pois).toHaveBeenCalledTimes(1);
  expect(routingApi.route).not.toHaveBeenCalled();
  expect(geolocation.watchPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate walking route' }));
  await screen.findByText('Current direction');
  expect(screen.getAllByText('Walk toward the library')).toHaveLength(2);
  expect(routingApi.route).toHaveBeenCalledWith(pois[0], pois[1], expect.any(AbortSignal));
});

test('GPS samples do not issue routes; ending navigation and unmount release all watches', async () => {
  let sample;
  const geolocation = { watchPosition: vi.fn((success) => { sample = success; return 0; }), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  const view = render(<Navigate />);
  await choose('Destination', 'lib', 'Library');
  fireEvent.click(screen.getByRole('button', { name: 'Use my browser location' }));
  act(() => sample({ coords: { latitude: 30.354, longitude: 76.361, accuracy: 10 }, timestamp: Date.now() }));
  fireEvent.click(screen.getByRole('button', { name: 'Calculate walking route' }));
  await screen.findByText('Current direction');
  expect(screen.getAllByText('Walk toward the library')).toHaveLength(2);
  for (let i = 0; i < 20; i++) act(() => sample({ coords: { latitude: 30.354 + i * 0.000001, longitude: 76.361, accuracy: 10 }, timestamp: Date.now() + i }));
  act(() => sample({ coords: { latitude: 30.355, longitude: 76.362, accuracy: 10 }, timestamp: Date.now() + 21 }));
  expect(screen.queryByText('Walk toward the library')).toBeNull();
  expect(screen.getAllByText('Arrive at Library')).toHaveLength(2);
  expect(routingApi.route).toHaveBeenCalledTimes(1);
  expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'End navigation' }));
  expect(geolocation.clearWatch).toHaveBeenCalledWith(0);
  view.unmount();
  expect(geolocation.clearWatch).toHaveBeenCalledTimes(1);
});

test('route failures appear inline; denied GPS still permits a manual origin', async () => {
  let denied;
  vi.stubGlobal('navigator', { geolocation: { watchPosition: vi.fn((ok, error) => { denied = error; return 4; }), clearWatch: vi.fn() } });
  routingApi.route.mockRejectedValue(new Error('No walking route could be found.'));
  render(<Navigate />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my browser location' }));
  act(() => denied({ code: 1 }));
  expect(screen.getByText(/Location permission was denied/)).toBeTruthy();
  await choose('Start at a campus place', 'gate', 'Main Gate');
  await choose('Destination', 'lib', 'Library');
  fireEvent.click(screen.getByRole('button', { name: 'Calculate walking route' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No walking route could be found.'));
});
