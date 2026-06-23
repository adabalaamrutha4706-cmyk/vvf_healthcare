import { Router } from 'express';
import {
  createFieldAppointment,
  getFieldAppointments,
  updateFieldAppointmentStatus,
  telecallerAction,
  reassignLeads,
  manualRebalanceLeads,
  getTelecallerPerformance,
  getRedistributionLogs
} from '../controllers/fieldAppointmentController';

const router = Router();

router.post('/', createFieldAppointment);
router.get('/', getFieldAppointments);
router.put('/:id/status', updateFieldAppointmentStatus);

// Telecaller and Admin assignment/rebalancing routes
router.put('/:id/telecaller-action', telecallerAction);
router.put('/reassign', reassignLeads);
router.post('/rebalance', manualRebalanceLeads);
router.get('/telecaller-performance', getTelecallerPerformance);
router.get('/redistribution-logs', getRedistributionLogs);

export default router;

