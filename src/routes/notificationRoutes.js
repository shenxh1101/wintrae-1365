import { Router } from 'express';
import { getPendingReminders, markNotificationRead, getNotificationList } from '../controllers/notificationController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { queryReminderSchema, queryNotificationSchema } from '../validation/notificationSchema.js';

const router = Router();

router.get('/reminders', validateRequest({ query: queryReminderSchema }), getPendingReminders);
router.get('/', validateRequest({ query: queryNotificationSchema }), getNotificationList);
router.patch('/:id/read', markNotificationRead);

export default router;
