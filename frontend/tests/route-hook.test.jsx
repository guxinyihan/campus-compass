import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useRoute } from '../src/hooks/useRoute';
import { routingApi } from '../src/services/routingApi';
vi.mock('../src/services/routingApi', () => ({ routingApi: { route: vi.fn() } }));
const route = (distance) => ({ distanceMeters: distance, durationSeconds: 60, geometry: { type: 'LineString', coordinates: [[76.36, 30.35], [76.37, 30.36]] }, instructions: [] });

test('a superseded route response cannot overwrite the latest destination and unmount aborts pending requests', async () => {
  const pending = [];
  routingApi.route.mockImplementation((start, end, signal) => new Promise((resolve) => pending.push({ resolve, signal })));
  const { result, unmount } = renderHook(() => useRoute());
  let first, second;
  act(() => { first = result.current.calculate({ lat: 30.35, lng: 76.36 }, { lat: 30.36, lng: 76.37 }); });
  act(() => { second = result.current.calculate({ lat: 30.35, lng: 76.36 }, { lat: 30.355, lng: 76.37 }); });
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => { pending[1].resolve(route(100)); await second; });
  await act(async () => { pending[0].resolve(route(200)); await first; });
  expect(result.current.route.distanceMeters).toBe(100);
  act(() => { result.current.calculate({ lat: 30.35, lng: 76.36 }, { lat: 30.36, lng: 76.37 }); });
  unmount();
  expect(pending[2].signal.aborted).toBe(true);
});
