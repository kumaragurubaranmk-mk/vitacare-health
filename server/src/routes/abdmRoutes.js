import { Router } from 'express';
import { AbdmController } from '../controllers/abdmController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();

// Public architecture documentation
router.get('/architecture', AbdmController.getArchitecture);

// Authenticated endpoints
router.use(authenticateUser);

router.get('/profile', AbdmController.getAbhaProfile);
router.post('/mock-otp', AbdmController.requestMockOtp);
router.post('/link', AbdmController.linkMockAbha);
router.post('/unlink', AbdmController.unlinkMockAbha);
router.get('/fhir/bundle', AbdmController.exportFhirBundle);
router.get('/consents', AbdmController.getConsents);
router.post('/consents', AbdmController.createConsent);
router.post('/consents/:id/revoke', AbdmController.revokeConsent);

export default router;
