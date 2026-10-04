import { config } from '../config';
import { request } from './http';

export const trackingApi = {
  snapshot: (signal) => request(config.trackingUrl, '/api/v1/vehicles', { signal }),
  publish: (id, token, position, signal) => request(config.trackingUrl, `/api/v1/vehicles/${encodeURIComponent(id)}/location`, {
    method: 'POST', token, signal,
    body: { lat: position.lat, lng: position.lng, accuracy: position.accuracy,
      ...(Number.isFinite(position.heading) ? { heading: position.heading } : {}) },
  }),
};
