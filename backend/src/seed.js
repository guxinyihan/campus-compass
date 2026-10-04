import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {loadConfig} from './config.js';
import {User, initializeIndexes} from './models.js';
import {parse, registration} from './validation.js';
try {
  const config = loadConfig(); const input = parse(registration, {name: 'Demo Administrator', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD});
  await mongoose.connect(config.mongoUri, {serverSelectionTimeoutMS: 8000}); await initializeIndexes();
  const existing = await User.findOne({email: input.email});
  if (existing && existing.role !== 'admin') throw new Error('Existing non-admin account must not be silently promoted.');
  if (!existing) await User.create({name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: 'admin'});
  console.log('Admin seed complete. No credentials are logged.');
} catch (error) { console.error('Admin seed failed:', error.name); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
