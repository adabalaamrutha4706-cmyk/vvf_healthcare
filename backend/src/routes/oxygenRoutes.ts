import { Router } from 'express';
import {
  getOxygenLogs,
  getOxygenSummaryStats,
  createOxygenLog,
  updateOxygenLog,
  deleteOxygenLog
} from '../controllers/oxygenController';
import { requireAuth } from '../middleware/auth';
import { uploadOxygen } from '../middleware/upload';

const router = Router();

router.get('/', requireAuth, getOxygenLogs);
router.get('/summary', requireAuth, getOxygenSummaryStats);
router.post('/', requireAuth, uploadOxygen.single('photo'), createOxygenLog);
router.put('/:id', requireAuth, uploadOxygen.single('photo'), updateOxygenLog);
router.delete('/:id', requireAuth, deleteOxygenLog);

export default router;
