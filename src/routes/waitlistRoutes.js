import { Router } from 'express';
import {
  joinWaitlist,
  cancelWaitlist,
  getWaitlistStatus,
  getWaitlistBySlot,
  confirmWaitlistBooking
} from '../controllers/waitlistController.js';

const router = Router();

router.post('/', joinWaitlist);
router.delete('/:id', cancelWaitlist);
router.get('/status', getWaitlistStatus);
router.get('/slot/:slotId', getWaitlistBySlot);
router.post('/:id/confirm', confirmWaitlistBooking);

export default router;
