import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import onboardingRoutes from './routes/onboarding.js';
import subjectsRoutes from './routes/subjects.js';
import surveyRoutes from './routes/survey.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve voice note uploads in dev mode
if (process.env.STORAGE_TYPE === 'local') {
  app.use('/uploads', express.static(path.resolve(process.env.STORAGE_PATH || './uploads')));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/survey', surveyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

app.listen(PORT, () => {
  console.log(`APE Survey API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
