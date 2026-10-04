import mongoose from 'mongoose';
import {loadConfig} from './config.js';
import {createApp} from './app.js';
import {initializeIndexes} from './models.js';
try {
  const config = loadConfig(); await mongoose.connect(config.mongoUri, {serverSelectionTimeoutMS: 8000}); await initializeIndexes();
  const server = createApp(config).listen(config.port, '0.0.0.0', () => console.log(`Identity API listening on ${config.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  });
} catch (error) { console.error('Identity API startup failed:', error.name); process.exitCode = 1; }
