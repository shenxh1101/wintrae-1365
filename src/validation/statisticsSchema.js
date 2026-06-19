import Joi from 'joi';

export const statsQuerySchema = Joi.object({
  startDate: Joi.string(),
  endDate: Joi.string(),
  department: Joi.string(),
  doctorId: Joi.string()
});

export const abnormalScheduleSchema = Joi.object({
  startDate: Joi.string(),
  endDate: Joi.string(),
  minSlots: Joi.number().integer().min(0).default(0)
});

export const adminSummarySchema = Joi.object({
  department: Joi.string().optional(),
  doctorId: Joi.string().optional(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}/).optional()
});
