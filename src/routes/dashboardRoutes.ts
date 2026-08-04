import { Router } from 'express';
import { getStats } from '../controllers/dashboardController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.get('/stats', requireAuth, getStats);

export default router;
