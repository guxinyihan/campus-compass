import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';
import MapComponent from '../src/components/MapComponent.jsx';

vi.mock('react-leaflet', () => {
  const container = ({ children }) => React.createElement('div', {}, children);
  return { MapContainer: container, TileLayer: () => null, Marker: () => null,
    Polyline: () => null, useMap: () => ({ setView() {} }) };
});
vi.mock('leaflet', () => ({ default: { Icon: class {}, divIcon: () => ({}),
  latLng: (value) => value, latLngBounds: () => ({}) } }));
vi.mock('axios', () => ({ default: { create: () => ({ interceptors: { request: { use() {} } } }),
  get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

test('all browser location watches are released when the map unmounts', () => {
  let sequence = 0;
  const geolocation = { watchPosition: vi.fn(() => sequence++), clearWatch: vi.fn() };
  vi.stubGlobal('navigator', { geolocation });
  vi.stubGlobal('window', { location: { pathname: '/map' } });
  let view;
  act(() => { view = create(<MapComponent navType="test" autosLoc={[]} activeAutoLoc={null} />); });
  act(() => view.unmount());
  expect(geolocation.watchPosition).toHaveBeenCalled();
  for (const result of geolocation.watchPosition.mock.results) {
    expect(geolocation.clearWatch).toHaveBeenCalledWith(result.value);
  }
});
