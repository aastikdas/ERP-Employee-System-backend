import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController';
import { requireAuth, requireRoles } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', requireAuth, getDepartments);
router.get('/:id', requireAuth, getDepartmentById);
router.post('/', requireAuth, requireRoles(['ADMIN', 'HR']), createDepartment);
router.put('/:id', requireAuth, requireRoles(['ADMIN', 'HR']), updateDepartment);
router.delete('/:id', requireAuth, requireRoles(['ADMIN', 'HR']), deleteDepartment);

export default router;
