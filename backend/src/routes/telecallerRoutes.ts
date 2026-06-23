import { Router } from 'express';
import leadRoutes from './leadRoutes';
import dashboardRoutes from './dashboardRoutes';
import visitRoutes from './visitRoutes';
import userRoutes from './userRoutes';
import hospitalRoutes from './hospitalRoutes';
import fieldAppointmentRoutes from './fieldAppointmentRoutes';

const router = Router();

router.use('/leads', leadRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/visits', visitRoutes);
router.use('/users', userRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/field-appointments', fieldAppointmentRoutes);

export default router;
