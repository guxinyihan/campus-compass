import { expect, test } from 'vitest';
import { searchPois } from '../src/domain/search';
import { deviationState, distanceToRoute, haversine, nextInstruction } from '../src/domain/navigation';
import { freshness, mergePosition } from '../src/hooks/useVehicles';

test('POI ranking is exact, prefix, word prefix, then substring with deterministic ties and aliases', () => {
  const pois = [
    { id: '4', name: 'Superlibrary' }, { id: '3', name: 'Main Library' },
    { id: '2', name: 'Library Annex' }, { id: '1', name: 'Library' },
    { id: '5', name: 'Central Reading Room', aliases: ['Library Hall'] },
  ];
  expect(searchPois(pois, '  LIBRARY ' ).map((poi) => poi.id)).toEqual(['1', '5', '2', '3', '4']);
  expect(searchPois([...pois].reverse(), 'library').map((poi) => poi.id)).toEqual(['1', '5', '2', '3', '4']);
  expect(searchPois(pois, '')).toEqual([]);
  expect(searchPois(pois, 'not a place')).toEqual([]);
});

test('campus distance and nearest-segment logic handle midpoints, endpoints and duplicate points', () => {
  expect(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeCloseTo(111.195, 1);
  expect(distanceToRoute({ lat: 0.0001, lng: 0.0005 }, [[0, 0], [0.001, 0]])).toBeCloseTo(11.12, 1);
  expect(distanceToRoute({ lat: 0, lng: 0.002 }, [[0, 0], [0.001, 0]])).toBeCloseTo(111.195, 1);
  expect(distanceToRoute({ lat: 0, lng: 0 }, [[0, 0], [0, 0]])).toBe(0);
  expect(distanceToRoute({ lat: 0, lng: 0 }, [])).toBe(Infinity);
});

test('progress advances without changing route or reading old instruction state', () => {
  const instructions = [{ point: { lat: 0, lng: 0 }, text: 'First' }, { point: { lat: 0, lng: 0.001 }, text: 'Second' }];
  const copy = JSON.stringify(instructions);
  expect(nextInstruction(instructions, 0, { lat: 0, lng: 0 })).toBe(0);
  expect(nextInstruction(instructions, 0, { lat: 0, lng: 0.001 })).toBe(1);
  expect(nextInstruction(instructions, 1, { lat: 0, lng: 0 })).toBe(1);
  expect(JSON.stringify(instructions)).toBe(copy);
});

test('deviation requires three accurate samples; GPS noise and poor accuracy reset it', () => {
  const route = [[0, 0], [0.001, 0]];
  const fix = { lat: 0.001, lng: 0.0005, accuracy: 10 };
  expect(deviationState(fix, route, 0).offRoute).toBe(false);
  expect(deviationState(fix, route, 1).offRoute).toBe(false);
  expect(deviationState(fix, route, 2).offRoute).toBe(true);
  expect(deviationState({ ...fix, accuracy: 80 }, route, 9).count).toBe(0);
  expect(deviationState({ ...fix, lat: 0.0001 }, route, 9).count).toBe(0);
});

test('vehicle state ignores late/invalid events and becomes stale then offline using server time', () => {
  const current = { vehicleId: 'v1', lat: 30.35, lng: 76.36, receivedAt: '2026-10-04T00:00:00Z' };
  const previous = { v1: current };
  expect(mergePosition(previous, { ...current, receivedAt: '2026-10-03T23:59:59Z' })).toBe(previous);
  expect(mergePosition(previous, { ...current, receivedAt: 'invalid' })).toBe(previous);
  expect(freshness(current, Date.parse(current.receivedAt) + 29999)).toBe('live');
  expect(freshness(current, Date.parse(current.receivedAt) + 30000)).toBe('stale');
  expect(freshness(current, Date.parse(current.receivedAt) + 120000)).toBe('offline');
  expect(freshness(null, Date.now())).toBe('offline');
});
