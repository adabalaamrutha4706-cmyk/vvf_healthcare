import { Router } from 'express';
import {
  getUsers,
  getDoctors,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Publicly authenticated endpoint to fetch doctors list for scheduling
router.get('/doctors', requireAuth, getDoctors);

// Admin-only User CRUD
router.get('/', requireAuth, requireRole(['Admin']), getUsers);
router.post('/', requireAuth, requireRole(['Admin']), createUser);
router.put('/:id', requireAuth, requireRole(['Admin']), updateUser);
router.delete('/:id', requireAuth, requireRole(['Admin']), deleteUser);

export default router;
