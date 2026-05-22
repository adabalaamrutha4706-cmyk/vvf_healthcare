import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import telecallerRoutes from './routes/telecallerRoutes';
import userRoutes from './routes/userRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup static uploads folder
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'VVF Healthcare backend is running.' });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/leads', telecallerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Custom error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// Run migrations/seed and start server
const startServer = async () => {
  try {
    console.log('Seeding/initializing database...');
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`Backend server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize and start backend server:', err);
    process.exit(1);
  }
};

startServer();
