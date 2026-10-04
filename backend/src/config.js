export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET || '';
  const trackingSecret = env.TRACKING_JWT_SECRET || '';
  if (jwtSecret.length < 32 || trackingSecret.length < 32 || jwtSecret === trackingSecret) {
    throw new Error('Distinct JWT_SECRET and TRACKING_JWT_SECRET of at least 32 characters are required.');
  }
  const origins = (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length || origins.some(s => !/^https?:\/\/[^/]+$/.test(s) || s.includes('*'))) throw new Error('Explicit HTTP(S) CORS_ORIGINS are required.');
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  return {jwtSecret, trackingSecret, origins, port, mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuscompass'};
}
