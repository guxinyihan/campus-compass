import { config } from '../config';
import { request } from './http';

export const routingApi = {
  campus: (signal) => request(config.routingUrl, '/api/campus', { signal }),
  pois: (signal) => request(config.routingUrl, '/api/pois', { signal }),
  route: (start, destination, signal) => request(config.routingUrl, '/api/routes', {
    method: 'POST', body: { start: { lat: start.lat, lng: start.lng }, destination: { lat: destination.lat, lng: destination.lng }, profile: 'walking' }, signal,
  }),
};
