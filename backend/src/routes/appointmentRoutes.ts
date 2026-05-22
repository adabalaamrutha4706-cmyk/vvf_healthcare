import { Router } from 'express';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
} from '../controllers/appointmentController';
import { addPayment, getPaymentHistory } from '../controllers/paymentController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Appointments CRUD
router.get('/', requireAuth, getAppointments);
router.get('/:id', requireAuth, getAppointmentById);
router.post('/', requireAuth, requireRole(['Admin', 'Reception']), createAppointment);
router.put('/:id', requireAuth, requireRole(['Admin', 'Chief Doctor', 'Doctor', 'Reception']), updateAppointment);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Chief Doctor']), deleteAppointment);

// Payments (nested inside appointments for standard REST patterns)
router.post('/:id/payments', requireAuth, requireRole(['Admin', 'Reception']), addPayment);
router.get('/:id/payments', requireAuth, getPaymentHistory);

export default router;
