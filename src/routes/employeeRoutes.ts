import { Router } from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getManagers,
  uploadAvatar,
} from '../controllers/employeeController';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware';
import { upload } from '../utils/upload';

const router = Router();

router.get('/', requireAuth, getEmployees);
router.get('/managers', requireAuth, getManagers);
router.get('/:id', requireAuth, getEmployeeById);
router.post('/', requireAuth, requireRoles(['ADMIN', 'HR']), createEmployee);
router.put('/:id', requireAuth, updateEmployee);
router.delete('/:id', requireAuth, requireRoles(['ADMIN', 'HR']), deleteEmployee);
router.post('/:id/avatar', requireAuth, upload.single('avatar'), uploadAvatar);

export default router;
