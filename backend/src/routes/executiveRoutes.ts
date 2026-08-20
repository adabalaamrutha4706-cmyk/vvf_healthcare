import { Router } from 'express';
import visitRoutes from './visitRoutes';
import hospitalRoutes from './hospitalRoutes';
import dashboardRoutes from './dashboardRoutes';
import userRoutes from './userRoutes';
import fieldAppointmentRoutes from './fieldAppointmentRoutes';
import therapyRoutes from './therapyRoutes';
import appointmentRoutes from './appointmentRoutes';

const router = Router();

router.use('/visits', visitRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/field-appointments', fieldAppointmentRoutes);
router.use('/therapies', therapyRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
