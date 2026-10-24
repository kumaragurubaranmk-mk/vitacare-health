import { Router } from 'express';
import { IntelligenceController } from '../controllers/intelligenceController.js';
import { optionalAuthUser } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/status', optionalAuthUser, IntelligenceController.getStatus);
router.post('/test-security', optionalAuthUser, IntelligenceController.testCrossProfileSecurity);

export default router;
