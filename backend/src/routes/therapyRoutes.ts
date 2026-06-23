import { Router } from 'express';
import {
  getTherapies,
  getTechnicians,
  getTherapyById,
  createTherapy,
  updateTherapy,
  verifyTherapy
} from '../controllers/therapyController';
import { requireAuth, authorize } from '../middleware/auth';

const router = Router();

// Retrieve all therapy sessions (supports query parameters for reports)
router.get('/', requireAuth, getTherapies);

// Retrieve all active technicians
router.get('/technicians', requireAuth, getTechnicians);

// Retrieve details for a single therapy session
router.get('/:id', requireAuth, getTherapyById);

// Create a new therapy session (Admin, OP Technician, Reception, Doctor, SOP Technician)
router.post('/', requireAuth, authorize(['Admin', 'Superadmin', 'OP Technician', 'SOP Technician', 'Reception', 'Doctor']), createTherapy);

// Update details/timings of a therapy session
router.put('/:id', requireAuth, authorize(['Admin', 'Superadmin', 'OP Technician', 'SOP Technician', 'Doctor']), updateTherapy);

// Verify/Sign off a therapy session
router.put('/:id/verify', requireAuth, authorize(['Admin', 'Superadmin', 'OP Technician', 'SOP Technician']), verifyTherapy);

export default router;
