import Joi from 'joi';

export const queryReminderSchema = Joi.object({
  days: Joi.number().integer().min(1).default(7),
  doctorId: Joi.string(),
  patientPhone: Joi.string()
});

export const queryNotificationSchema = Joi.object({
  doctorId: Joi.string().optional(),
  patientPhone: Joi.string().optional(),
  read: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10)
});
