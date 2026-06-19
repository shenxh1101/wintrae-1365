import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createWeeklySchedule,
  createTemporarySchedule,
  createSuspension,
  cancelSchedule,
  getScheduleList,
  getScheduleDetail
} from '../controllers/scheduleController.js';
import {
  weeklyScheduleSchema,
  temporaryScheduleSchema,
  suspensionSchema,
  queryScheduleSchema
} from '../validation/scheduleSchema.js';

const router = Router();

router.post('/weekly', validateRequest({ body: weeklyScheduleSchema }), createWeeklySchedule);
router.post('/temporary', validateRequest({ body: temporaryScheduleSchema }), createTemporarySchedule);
router.post('/suspension', validateRequest({ body: suspensionSchema }), createSuspension);
router.get('/', validateRequest({ query: queryScheduleSchema }), getScheduleList);
router.get('/:id', getScheduleDetail);
router.delete('/:id', cancelSchedule);

export default router;
