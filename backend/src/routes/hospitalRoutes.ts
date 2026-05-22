import { Router } from 'express';
import {
  getHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  deleteHospital
} from '../controllers/hospitalController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getHospitals);
router.get('/:id', requireAuth, getHospitalById);
router.post('/', requireAuth, requireRole(['Admin']), createHospital);
router.put('/:id', requireAuth, requireRole(['Admin']), updateHospital);
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteHospital);

export default router;
