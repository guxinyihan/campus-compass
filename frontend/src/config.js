const env = import.meta.env;

export const config = {
  identityUrl: (env.VITE_API_URL || '/identity').replace(/\/$/, ''),
  routingUrl: (env.VITE_ROUTING_API_URL || '/routing').replace(/\/$/, ''),
  trackingUrl: (env.VITE_TRACKING_API_URL || '/tracking').replace(/\/$/, ''),
  trackingWsUrl: env.VITE_TRACKING_WS_URL || '/tracking/ws/vehicles',
  tileUrl: env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export function websocketUrl(path) {
  const url = new URL(path, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
  return url.href;
}
