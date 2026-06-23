import { Router } from 'express';
import {
  getStats,
  getChartData,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/stats', requireAuth, getStats);
router.get('/charts', requireAuth, getChartData);
router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/read-all', requireAuth, markAllNotificationsRead);
router.put('/notifications/:id/read', requireAuth, markNotificationRead);

export default router;
