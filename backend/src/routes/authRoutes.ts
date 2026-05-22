import { Router } from 'express';
import { login, logout, punch, getAttendance, getMe, updateProfile } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.post('/punch', requireAuth, punch);
router.get('/attendance', requireAuth, getAttendance);
router.put('/profile', requireAuth, updateProfile);

export default router;

