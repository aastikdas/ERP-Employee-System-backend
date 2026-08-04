import { Router } from 'express';
import {
  clockIn,
  clockOut,
  getPersonalHistory,
  getTodayAttendance,
  getEmployeeAttendanceDetails,
  updateAttendance,
} from '../controllers/attendanceController';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware';

const router = Router();

router.post('/clock-in', requireAuth, clockIn);
router.post('/clock-out', requireAuth, clockOut);
router.get('/history', requireAuth, getPersonalHistory);
router.get('/today', requireAuth, requireRoles(['ADMIN', 'HR', 'MANAGER']), getTodayAttendance);
router.get('/employee/:employeeId', requireAuth, requireRoles(['ADMIN', 'HR', 'MANAGER']), getEmployeeAttendanceDetails);
router.put('/:id', requireAuth, requireRoles(['ADMIN', 'HR']), updateAttendance);

export default router;
