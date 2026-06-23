import { Router } from 'express';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  restoreAppointment,
  getPendingPayments,
  getAppointmentEditHistory,
  moveAppointmentToTelecalling
} from '../controllers/appointmentController';
import { addPayment, getPaymentHistory, getPaymentsReport, updatePayment } from '../controllers/paymentController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Appointments CRUD
router.get('/', requireAuth, getAppointments);
router.get('/pending-payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception', 'Doctor', 'Dental Doctor']), getPendingPayments);
router.get('/payments-report', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception']), getPaymentsReport);
router.get('/:id', requireAuth, getAppointmentById);
router.get('/:id/history', requireAuth, getAppointmentEditHistory);
router.post('/', requireAuth, requireRole(['Admin', 'Reception', 'Superadmin']), createAppointment);
router.put('/:id', requireAuth, requireRole(['Admin', 'Doctor', 'Dental Doctor', 'Reception', 'Superadmin']), updateAppointment);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Superadmin']), deleteAppointment);
router.put('/:id/restore', requireAuth, requireRole(['Admin', 'Superadmin']), restoreAppointment);
router.put('/:id/move-to-telecalling', requireAuth, requireRole(['Admin', 'Doctor', 'Dental Doctor', 'Reception', 'Superadmin']), moveAppointmentToTelecalling);

// Payments (nested inside appointments for standard REST patterns)
router.post('/:id/payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception']), addPayment);
router.get('/:id/payments', requireAuth, requireRole(['Admin', 'Superadmin', 'Reception']), getPaymentHistory);
router.put('/:id/payments/:paymentId', requireAuth, requireRole(['Admin', 'Superadmin']), updatePayment);

export default router;
