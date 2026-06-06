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

router.get('/', requireAuth, requireRole(['Admin', 'Telecaller', 'Superadmin']), getLeads);
router.get('/:id', requireAuth, requireRole(['Admin', 'Telecaller', 'Superadmin']), getLeadById);
router.post('/', requireAuth, requireRole(['Admin', 'Telecaller', 'Superadmin']), createLead);
router.put('/:id', requireAuth, requireRole(['Admin', 'Telecaller', 'Superadmin']), updateLead);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Superadmin']), deleteLead);

export default router;
