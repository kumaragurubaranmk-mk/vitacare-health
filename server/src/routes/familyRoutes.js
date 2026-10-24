import { Router } from 'express';
import { FamilyController } from '../controllers/familyController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();

// All family management endpoints require authentication
router.use(authenticateUser);

router.get('/', FamilyController.getFamilyMembers);
router.post('/', FamilyController.createFamilyMember);
router.get('/:memberId', FamilyController.getFamilyMember);
router.put('/:memberId', FamilyController.updateFamilyMember);
router.delete('/:memberId', FamilyController.revokeFamilyAccess);
router.get('/:memberId/summary', FamilyController.getFamilySummary);

export default router;
