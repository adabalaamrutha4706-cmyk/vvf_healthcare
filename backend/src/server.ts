import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
// @ts-ignore
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env variables
dotenv.config();

// Imports database seeds
import { seedDatabase } from './config/seed';

// Imports routers
import authRoutes from './routes/authRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import visitRoutes from './routes/visitRoutes';
import leadRoutes from './routes/leadRoutes';
import userRoutes from './routes/userRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import superadminRoutes from './routes/superadminRoutes';
import therapyRoutes from './routes/therapyRoutes';

// Imports role routers
import adminRoutes from './routes/adminRoutes';
import dentalDoctorRoutes from './routes/dentalDoctorRoutes';
import doctorRoutes from './routes/doctorRoutes';
import executiveRoutes from './routes/executiveRoutes';
import receptionRoutes from './routes/receptionRoutes';
import telecallerRoutes from './routes/telecallerRoutes';

import { requireAuth, authorize } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Suppress technology headers
app.disable('x-powered-by');

// Security Middleware (Helmet) - Disable CSP & COEP to avoid breaking frontend dynamic assets
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Enable CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3005',
  'https://localhost:3005',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://127.0.0.1:3005',
  'https://127.0.0.1:3005',
  'https://vvf.thehps.in'
];
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...envOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or local script requests with no origin
    if (!origin) {
      return callback(null, true);
    }
    
    // Exact whitelist check
    const isAllowed = allowedOrigins.some(o => o === origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204 // Avoid returning content on preflight requests
}));
// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup static uploads folder
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir, {
  setHeaders: (res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Prevent caching of all API responses containing sensitive data
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'VVF Healthcare backend is running.' });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/superadmin', superadminRoutes);

// Role-based portals endpoints
app.use('/api/admin/therapies', requireAuth, authorize(['Admin']), therapyRoutes);
app.use('/api/op-technician/therapies', requireAuth, authorize(['OP Technician']), therapyRoutes);
app.use('/api/sop-technician/therapies', requireAuth, authorize(['SOP Technician']), therapyRoutes);
app.use('/api/op-technician/dashboard', requireAuth, authorize(['OP Technician']), dashboardRoutes);
app.use('/api/sop-technician/dashboard', requireAuth, authorize(['SOP Technician']), dashboardRoutes);

app.use('/api/op-technician/hospitals', requireAuth, authorize(['OP Technician']), hospitalRoutes);
app.use('/api/op-technician/appointments', requireAuth, authorize(['OP Technician']), appointmentRoutes);
app.use('/api/op-technician/users', requireAuth, authorize(['OP Technician']), userRoutes);

app.use('/api/sop-technician/hospitals', requireAuth, authorize(['SOP Technician']), hospitalRoutes);
app.use('/api/sop-technician/appointments', requireAuth, authorize(['SOP Technician']), appointmentRoutes);
app.use('/api/sop-technician/users', requireAuth, authorize(['SOP Technician']), userRoutes);

app.use('/api/admin', requireAuth, authorize(['Admin']), adminRoutes);
app.use('/api/doctor', requireAuth, authorize(['Doctor']), doctorRoutes);
app.use('/api/dental-doctor', requireAuth, authorize(['Dental Doctor']), dentalDoctorRoutes);
app.use('/api/dentist-junior', requireAuth, authorize(['Dentist Junior']), dentalDoctorRoutes);
app.use('/api/dental-assistant', requireAuth, authorize(['Dental Assistant']), dentalDoctorRoutes);
app.use('/api/executive', requireAuth, authorize(['Executive']), executiveRoutes);
app.use('/api/reception', requireAuth, authorize(['Reception']), receptionRoutes);
app.use('/api/telecaller', requireAuth, authorize(['Telecaller']), telecallerRoutes);


// Custom error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  
  // Protect internal systems: sanitize messages in production to prevent leaking db or server internals
  let message = err.message || 'Internal server error';
  if (process.env.NODE_ENV === 'production' && status === 500) {
    message = 'An unexpected error occurred. Please contact system support.';
  }

  res.status(status).json({
    success: false,
    message,
    errorCode: err.errorCode || 'UNHANDLED_ERROR'
  });
});

import { expireOverdueVisits } from './controllers/visitController';

// Run migrations/seed and start server
const startServer = async () => {
  try {
    console.log('Seeding/initializing database...');
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
      
      // Background auto-expiration and reminder job runs every 5 minutes
      expireOverdueVisits().catch(err => console.error('Initial expiration run failed:', err));
      setInterval(() => {
        expireOverdueVisits().catch(err => console.error('Background expiration run failed:', err));
      }, 5 * 60 * 1000);
    });
  } catch (err) {
    console.error('Failed to initialize and start backend server:', err);
    process.exit(1);
  }
};

startServer();
// Dev reload comment 4
