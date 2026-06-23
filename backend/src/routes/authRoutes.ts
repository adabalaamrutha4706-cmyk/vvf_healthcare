import { Router } from 'express';
import { login, logout, autoLogout, punch, getAttendance, getMe, updateProfile, uploadProfilePhoto, requestPasswordReset } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { uploadProfile } from '../middleware/upload';

const router = Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.post('/auto-logout', requireAuth, autoLogout);
router.get('/me', requireAuth, getMe);
router.post('/punch', requireAuth, punch);
router.get('/attendance', requireAuth, getAttendance);
router.put('/profile', requireAuth, updateProfile);
router.post('/profile/photo', requireAuth, uploadProfile.single('photo'), uploadProfilePhoto);
router.post('/forgot-password-request', requestPasswordReset);

export default router;
