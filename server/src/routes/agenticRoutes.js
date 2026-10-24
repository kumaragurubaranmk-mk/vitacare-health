import { Router } from 'express';
import { AgenticController } from '../controllers/agenticController.js';
import { authenticateUser, optionalAuthUser } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/tools', AgenticController.getTools);
router.post('/query', optionalAuthUser, AgenticController.processQuery);

// Authenticated confirmation & logs
router.use(authenticateUser);
router.post('/confirm', AgenticController.confirmAction);
router.get('/logs', AgenticController.getLogs);

export default router;
