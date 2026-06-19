import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  lockSlotSchema,
  confirmSchema,
  cancelSchema,
  rescheduleSchema,
  noShowSchema,
  queryAppointmentSchema
} from '../validation/appointmentSchema.js';
import {
  lockSlot,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  markNoShow,
  getAppointmentList,
  getAppointmentDetail
} from '../controllers/appointmentController.js';

const router = Router();

router.post('/lock', validateRequest(lockSlotSchema), lockSlot);
router.post('/confirm', validateRequest(confirmSchema), confirmAppointment);
router.post('/:id/cancel', validateRequest(cancelSchema), cancelAppointment);
router.post('/:id/reschedule', validateRequest(rescheduleSchema), rescheduleAppointment);
router.post('/:id/no-show', validateRequest(noShowSchema), markNoShow);
router.get('/', validateRequest(queryAppointmentSchema), getAppointmentList);
router.get('/:id', getAppointmentDetail);

export default router;
