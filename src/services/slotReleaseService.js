import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import Waitlist from '../models/Waitlist.js';
import { withTransaction } from '../utils/transaction.js';
import { createWaitlistNotification } from './notificationService.js';

const NOTIFICATION_EXPIRE_MINUTES = 30;

export async function releaseSlot(slotId, reason) {
  return withTransaction(async (session) => {
    const slot = await Slot.findById(slotId).session(session);
    if (!slot) {
      throw new Error('号源不存在');
    }

    slot.status = 'available';
    slot.patientName = undefined;
    slot.patientPhone = undefined;
    slot.lockedAt = undefined;
    slot.appointmentId = undefined;
    await slot.save({ session });

    const waitlist = await Waitlist.findOne({
      slotId,
      status: 'waiting'
    })
      .sort({ position: 1 })
      .session(session);

    let notifiedWaitlist = null;
    if (waitlist) {
      const now = new Date();
      waitlist.status = 'notification_sent';
      waitlist.notifiedAt = now;
      waitlist.expiredAt = new Date(now.getTime() + NOTIFICATION_EXPIRE_MINUTES * 60 * 1000);
      await waitlist.save({ session });

      const doctor = await Doctor.findById(slot.doctorId).session(session);
      if (doctor) {
        await createWaitlistNotification(waitlist, slot, doctor, session);
      }

      notifiedWaitlist = waitlist;
    }

    return {
      success: true,
      slot,
      reason,
      notifiedWaitlist
    };
  });
}

export async function expireLock(slotId) {
  return releaseSlot(slotId, 'lock_expired');
}

export default {
  releaseSlot,
  expireLock
};
