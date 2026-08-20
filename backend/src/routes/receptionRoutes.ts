import { Router } from 'express';
import appointmentRoutes from './appointmentRoutes';
import hospitalRoutes from './hospitalRoutes';
import dashboardRoutes from './dashboardRoutes';
import visitRoutes from './visitRoutes';
import userRoutes from './userRoutes';
import therapyRoutes from './therapyRoutes';

const router = Router();

router.use('/appointments', appointmentRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/visits', visitRoutes);
router.use('/users', userRoutes);
router.use('/therapies', therapyRoutes);

export default router;
