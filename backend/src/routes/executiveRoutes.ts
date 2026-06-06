import { Router } from 'express';
import visitRoutes from './visitRoutes';
import hospitalRoutes from './hospitalRoutes';
import dashboardRoutes from './dashboardRoutes';
import userRoutes from './userRoutes';

const router = Router();

router.use('/visits', visitRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);

export default router;
