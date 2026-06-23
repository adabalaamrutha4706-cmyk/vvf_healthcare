import { Router } from 'express';
import appointmentRoutes from './appointmentRoutes';
import hospitalRoutes from './hospitalRoutes';
import visitRoutes from './visitRoutes';
import leadRoutes from './leadRoutes';
import userRoutes from './userRoutes';
import dashboardRoutes from './dashboardRoutes';
import reportsRoutes from './reportsRoutes';
import fieldAppointmentRoutes from './fieldAppointmentRoutes';

const router = Router();

router.use('/appointments', appointmentRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/visits', visitRoutes);
router.use('/leads', leadRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/field-appointments', fieldAppointmentRoutes);

export default router;
