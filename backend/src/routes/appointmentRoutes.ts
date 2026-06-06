import { Router } from 'express';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  restoreAppointment,
  getPendingPayments,
  getAppointmentEditHistory
} from '../controllers/appointmentController';
import { addPayment, getPaymentHistory } from '../controllers/paymentController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Appointments CRUD
router.get('/', requireAuth, getAppointments);
router.get('/pending-payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception', 'Doctor']), getPendingPayments);
router.get('/:id', requireAuth, getAppointmentById);
router.get('/:id/history', requireAuth, getAppointmentEditHistory);
router.post('/', requireAuth, requireRole(['Admin', 'Reception', 'Superadmin']), createAppointment);
router.put('/:id', requireAuth, requireRole(['Admin', 'Chief Doctor', 'Doctor', 'Reception', 'Superadmin']), updateAppointment);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Chief Doctor', 'Superadmin']), deleteAppointment);
router.put('/:id/restore', requireAuth, requireRole(['Admin', 'Superadmin']), restoreAppointment);

// Payments (nested inside appointments for standard REST patterns)
router.post('/:id/payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception']), addPayment);
router.get('/:id/payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception']), getPaymentHistory);

export default router;
