import { Router } from 'express';
import {
  startVisit,
  uploadVisitPhoto,
  endVisit,
  reopenVisit,
  verifyVisit,
  getVisits,
  getVisitById,
  cancelVisit,
  updateVisitNotes
} from '../controllers/visitController';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', requireAuth, getVisits);
router.get('/:id', requireAuth, getVisitById);
router.post('/start', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), upload.single('photo'), startVisit);
router.post('/:id/photos', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), upload.single('photo'), uploadVisitPhoto);
router.post('/:id/end', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), upload.single('photo'), endVisit);
router.post('/:id/complete', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), upload.single('photo'), endVisit);
router.put('/:id/notes', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), updateVisitNotes);
router.post('/:id/reopen', requireAuth, requireRole(['Admin', 'Superadmin']), reopenVisit);
router.put('/:id/verify', requireAuth, requireRole(['Admin', 'Superadmin']), verifyVisit);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Executive', 'Superadmin']), cancelVisit);

export default router;
