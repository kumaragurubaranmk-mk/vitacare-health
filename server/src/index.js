import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { initDatabase } from './database/db.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import medicationRoutes from './routes/medicationRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import educationRoutes from './routes/educationRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import guardianRoutes from './routes/guardianRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import timelineRoutes from './routes/timelineRoutes.js';
import careconnectRoutes from './routes/careconnectRoutes.js';
import familyRoutes from './routes/familyRoutes.js';
import abdmRoutes from './routes/abdmRoutes.js';
import agenticRoutes from './routes/agenticRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';

// Initialize Database on startup
initDatabase();

const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    platform: 'VitaCare AI – Personal Health Copilot',
    tagline: 'Your Health. Organized. Intelligent. Connected.',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Download Complete Project Package (ZIP)
app.get('/api/download-project', (req, res) => {
  const zipPath = path.resolve(__dirname, '../../VitaCare-AI-HealthGPT.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="VitaCare-AI-HealthGPT.zip"');
    res.setHeader('Content-Type', 'application/zip');
    return res.sendFile(zipPath);
  }
  res.status(404).json({ error: 'Project archive not found. Please contact administrator.' });
});

// Mount API Modules
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/medicine', medicationRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/careconnect', careconnectRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/abdm', abdmRoutes);
app.use('/api/agentic', agenticRoutes);
app.use('/api/intelligence', intelligenceRoutes);

// Serve production static frontend if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 Route Handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint '${req.originalUrl}' not found.` });
});

// Centralized Error Handling
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 HealthGPT Backend Server running on port ${config.port}`);
  console.log(`🔗 API Base: http://localhost:${config.port}/api`);
  console.log(`🛡️ Admin Portal Endpoint: http://localhost:${config.port}/api/admin`);
  console.log(`=======================================================`);
});

export default app;
