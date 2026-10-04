import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {User, Vehicle, Notice, publicUser, publicVehicle, publicNotice} from './models.js';
import {authenticate, requireRole, accessToken} from './auth.js';
import {ApiFailure, parse, objectId, registration, login} from './validation.js';
import {adminRouter} from './admin.js';
export function createApp(config, {limits = true} = {}) {
  const app = express(); app.disable('x-powered-by'); app.use(helmet());
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !config.origins.includes(origin)) throw new ApiFailure(403, 'ORIGIN_DENIED', 'Origin is not allowed.'); next();
  });
  app.use(cors({origin: config.origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization']}));
  app.use(express.json({limit: '16kb'}));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/live', (req, res) => res.json({status: 'alive'}));
  app.get('/health', async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error(); await mongoose.connection.db.admin().ping();
      res.json({status: 'healthy', dependencies: {mongo: 'ready'}});
    } catch { res.status(503).json({status: 'unavailable', dependencies: {mongo: 'unavailable'}}); }
  });
  if (limits) app.use('/api/auth', rateLimit({windowMs: 900000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({error: {code: 'RATE_LIMITED', message: 'Try signing in again later.'}})}));
  app.post('/api/auth/register', async (req, res) => {
    const input = parse(registration, req.body);
    const user = await User.create({name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: 'student'});
    res.status(201).json({user: publicUser(user), accessToken: accessToken(user, config), expiresIn: 900});
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = parse(login, req.body); const user = await User.findOne({email: input.email}).select('+passwordHash');
    if (!user || !await bcrypt.compare(input.password, user.passwordHash)) throw new ApiFailure(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    res.json({user: publicUser(user), accessToken: accessToken(user, config), expiresIn: 900});
  });
  app.get('/api/vehicles', async (req, res) => res.json({vehicles: (await Vehicle.find({active: true}).sort({code: 1}).limit(100)).map(v => publicVehicle(v))}));
  app.get('/api/notices', async (req, res) => {
    const now = new Date(); res.json({notices: (await Notice.find({activeFrom: {$lte: now}, activeUntil: {$gt: now}}).sort({activeFrom: -1}).limit(100)).map(publicNotice)});
  });
  const auth = authenticate(config);
  app.get('/api/auth/me', auth, (req, res) => res.json({user: publicUser(req.user)}));
  app.get('/api/driver/vehicles', auth, requireRole('driver'), async (req, res) => res.json({vehicles: (await Vehicle.find({assignedDriver: req.user._id, active: true})).map(v => publicVehicle(v))}));
  app.post('/api/vehicles/:id/tracking-token', auth, requireRole('driver'), async (req, res) => {
    const id = parse(objectId, req.params.id); const vehicle = await Vehicle.findOne({_id: id, assignedDriver: req.user._id, active: true});
    if (!vehicle) throw new ApiFailure(403, 'NOT_ASSIGNED', 'You are not assigned to this active vehicle.');
    const trackingToken = jwt.sign({role: 'driver', vehicleId: id, tokenType: 'tracking'}, config.trackingSecret,
      {algorithm: 'HS256', issuer: 'campuscompass-api', audience: 'campuscompass-tracking', subject: String(req.user._id), expiresIn: 120});
    res.json({trackingToken, expiresIn: 120});
  });
  app.use('/api/admin', auth, requireRole('admin'), adminRouter());
  app.use((req, res) => res.status(404).json({error: {code: 'NOT_FOUND', message: 'Endpoint not found.'}}));
  app.use((err, req, res, _next) => {
    if (err instanceof ApiFailure) return res.status(err.status).json({error: {code: err.code, message: err.message}});
    if (err.code === 11000) return res.status(409).json({error: {code: 'CONFLICT', message: 'Email, vehicle code or driver assignment already exists.'}});
    if (err.type === 'entity.parse.failed') return res.status(400).json({error: {code: 'INVALID_JSON', message: 'Invalid JSON body.'}});
    if (err.type === 'entity.too.large') return res.status(413).json({error: {code: 'BODY_TOO_LARGE', message: 'Request body is too large.'}});
    console.error('API request failed', err.name || 'Error');
    return res.status(503).json({error: {code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.'}});
  });
  return app;
}
