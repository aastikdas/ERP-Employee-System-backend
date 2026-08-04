import { Router } from 'express';
import {
  applyLeave,
  getPersonalLeaves,
  getPendingLeaves,
  getAllLeaves,
  updateLeaveStatus,
  cancelLeave,
} from '../controllers/leaveController';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware';

const router = Router();

router.post('/apply', requireAuth, applyLeave);
router.get('/my-leaves', requireAuth, getPersonalLeaves);
router.get('/pending', requireAuth, requireRoles(['ADMIN', 'HR', 'MANAGER']), getPendingLeaves);
router.get('/all', requireAuth, requireRoles(['ADMIN', 'HR', 'MANAGER']), getAllLeaves);
router.put('/:id/status', requireAuth, requireRoles(['ADMIN', 'HR', 'MANAGER']), updateLeaveStatus);
router.delete('/:id', requireAuth, cancelLeave);

export default router;
