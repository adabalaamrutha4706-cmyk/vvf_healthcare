import { Router } from 'express';
import { getDailyReports } from '../controllers/reportsController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Retrieve daily user activity and productivity report
router.get('/daily', requireAuth, requireRole(['Admin', 'Superadmin']), getDailyReports);

export default router;
