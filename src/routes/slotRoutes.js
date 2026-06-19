import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  generateSlotsFromSchedule,
  getSlotList,
  getDoctorDailyRemaining
} from '../controllers/slotController.js';
import {
  generateSlotsSchema,
  querySlotSchema
} from '../validation/slotSchema.js';

const router = Router();

router.post('/generate', validateRequest({ body: generateSlotsSchema }), generateSlotsFromSchedule);
router.get('/', validateRequest({ query: querySlotSchema }), getSlotList);
router.get('/remaining', getDoctorDailyRemaining);

export default router;
