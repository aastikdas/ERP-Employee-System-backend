import { Router } from 'express';
import {
  generatePayroll,
  getPersonalPayroll,
  getAllPayroll,
  updatePayrollStatus,
} from '../controllers/payrollController';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware';

const router = Router();

router.post('/generate', requireAuth, requireRoles(['ADMIN', 'HR']), generatePayroll);
router.get('/my-payslips', requireAuth, getPersonalPayroll);
router.get('/all', requireAuth, requireRoles(['ADMIN', 'HR']), getAllPayroll);
router.put('/:id/status', requireAuth, requireRoles(['ADMIN', 'HR']), updatePayrollStatus);

export default router;
