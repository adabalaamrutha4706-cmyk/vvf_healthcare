import { Router } from 'express';
import {
  startVisit,
  uploadVisitPhoto,
  endVisit,
  verifyVisit,
  getVisits,
  getVisitById
} from '../controllers/visitController';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', requireAuth, getVisits);
router.get('/:id', requireAuth, getVisitById);
router.post('/start', requireAuth, requireRole(['Admin', 'Executive']), startVisit);
router.post('/:id/photos', requireAuth, requireRole(['Admin', 'Executive']), upload.single('photo'), uploadVisitPhoto);
router.post('/:id/end', requireAuth, requireRole(['Admin', 'Executive']), endVisit);
router.put('/:id/verify', requireAuth, requireRole(['Admin']), verifyVisit);

export default router;
