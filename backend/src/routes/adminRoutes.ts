import { Router } from 'express';
import appointmentRoutes from './appointmentRoutes';
import hospitalRoutes from './hospitalRoutes';
import visitRoutes from './visitRoutes';
import leadRoutes from './leadRoutes';
import userRoutes from './userRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.use('/appointments', appointmentRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/visits', visitRoutes);
router.use('/leads', leadRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
