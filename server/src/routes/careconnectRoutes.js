import { Router } from 'express';
import { CareConnectController } from '../controllers/careconnectController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authenticateUser);

router.post('/call', CareConnectController.createSession);
router.post('/session', CareConnectController.createSession);
router.post('/signal/:sessionId', CareConnectController.postSignal);
router.get('/signal/:sessionId', CareConnectController.getSignals);
router.post('/end/:sessionId', CareConnectController.endSession);
router.post('/call/:sessionId/end', CareConnectController.endSession);
router.get('/history', CareConnectController.getHistory);

export default router;
