import { Router } from 'express';
import leadRoutes from './leadRoutes';
import dashboardRoutes from './dashboardRoutes';
import visitRoutes from './visitRoutes';
import userRoutes from './userRoutes';
import hospitalRoutes from './hospitalRoutes';
import fieldAppointmentRoutes from './fieldAppointmentRoutes';
import therapyRoutes from './therapyRoutes';
import appointmentRoutes from './appointmentRoutes';

const router = Router();

router.use('/leads', leadRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/visits', visitRoutes);
router.use('/users', userRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/field-appointments', fieldAppointmentRoutes);
router.use('/therapies', therapyRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
