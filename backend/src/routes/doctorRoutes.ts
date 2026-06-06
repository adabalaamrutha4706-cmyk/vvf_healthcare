import { Router } from 'express';
import appointmentRoutes from './appointmentRoutes';
import dashboardRoutes from './dashboardRoutes';
import visitRoutes from './visitRoutes';
import userRoutes from './userRoutes';
import hospitalRoutes from './hospitalRoutes';

const router = Router();

router.use('/appointments', appointmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/visits', visitRoutes);
router.use('/users', userRoutes);
router.use('/hospitals', hospitalRoutes);

export default router;
