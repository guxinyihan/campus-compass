import { config } from '../config';
import { request } from './http';

export const identityApi = {
  login: (body) => request(config.identityUrl, '/api/auth/login', { method: 'POST', body }),
  register: (body) => request(config.identityUrl, '/api/auth/register', { method: 'POST', body }),
  vehicles: (signal) => request(config.identityUrl, '/api/vehicles', { signal }),
  notices: (signal) => request(config.identityUrl, '/api/notices', { signal }),
  assignedVehicles: (token, signal) => request(config.identityUrl, '/api/driver/vehicles', { token, signal }),
  trackingToken: (id, token, signal) => request(config.identityUrl, `/api/vehicles/${encodeURIComponent(id)}/tracking-token`, { token, method: 'POST', signal }),
  admin: (path, token, options = {}) => request(config.identityUrl, `/api/admin${path}`, { token, ...options }),
};
