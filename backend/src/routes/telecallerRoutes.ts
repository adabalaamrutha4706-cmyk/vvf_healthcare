import { Router } from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead
} from '../controllers/telecallerController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, requireRole(['Admin', 'Telecaller']), getLeads);
router.get('/:id', requireAuth, requireRole(['Admin', 'Telecaller']), getLeadById);
router.post('/', requireAuth, requireRole(['Admin', 'Telecaller']), createLead);
router.put('/:id', requireAuth, requireRole(['Admin', 'Telecaller']), updateLead);
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteLead);

export default router;
