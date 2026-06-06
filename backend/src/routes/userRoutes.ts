import { Router } from 'express';
import {
  getUsers,
  getDoctors,
  getExecutives,
  getTelecallers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser
} from '../controllers/userController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Publicly authenticated endpoint to fetch doctors list for scheduling
router.get('/doctors', requireAuth, getDoctors);
router.get('/executives', requireAuth, getExecutives);
router.get('/telecallers', requireAuth, getTelecallers);

// Admin & Superadmin User CRUD
router.get('/', requireAuth, requireRole(['Admin', 'Superadmin']), getUsers);
router.post('/', requireAuth, requireRole(['Admin', 'Superadmin']), createUser);
router.put('/:id', requireAuth, requireRole(['Admin', 'Superadmin']), updateUser);
router.delete('/:id', requireAuth, requireRole(['Admin', 'Superadmin']), deleteUser);
router.put('/:id/restore', requireAuth, requireRole(['Admin', 'Superadmin']), restoreUser);

export default router;
