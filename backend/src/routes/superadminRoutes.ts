import { Router } from 'express';
import {
  getStats,
  getUsers,
  getAttendance,
  getAuditLogs,
  getAppointments,
  deleteUserPermanent,
  deleteAppointmentPermanent
} from '../controllers/superadminController';
import { requireAuth, requireSuperadmin } from '../middleware/auth';

const router = Router();

// Apply auth and Superadmin guard to all routes
router.use(requireAuth);
router.use(requireSuperadmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/attendance', getAttendance);
router.get('/audit-logs', getAuditLogs);
router.get('/appointments', getAppointments);
router.delete('/users/:id/permanent', deleteUserPermanent);
router.delete('/appointments/:id/permanent', deleteAppointmentPermanent);

export default router;
