import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createWeeklySchedule,
  createTemporarySchedule,
  cancelSchedule,
  getScheduleList,
  getScheduleDetail
} from '../controllers/scheduleController.js';
import {
  weeklyScheduleSchema,
  temporaryScheduleSchema,
  queryScheduleSchema
} from '../validation/scheduleSchema.js';

const router = Router();

router.post('/weekly', validateRequest({ body: weeklyScheduleSchema }), createWeeklySchedule);
router.post('/temporary', validateRequest({ body: temporaryScheduleSchema }), createTemporarySchedule);
router.get('/', validateRequest({ query: queryScheduleSchema }), getScheduleList);
router.get('/:id', getScheduleDetail);
router.delete('/:id', cancelSchedule);

export default router;
