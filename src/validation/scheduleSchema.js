import Joi from 'joi';

const weeklyScheduleSchema = Joi.object({
  doctorId: Joi.string().required(),
  startDate: Joi.string().required(),
  dailySchedules: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().min(0).max(6).required(),
      startTime: Joi.string().required(),
      endTime: Joi.string().required(),
      totalSlots: Joi.number().min(0).default(0)
    })
  ).min(1).required()
});

const temporaryScheduleSchema = Joi.object({
  doctorId: Joi.string().required(),
  date: Joi.string().required(),
  startTime: Joi.string().required(),
  endTime: Joi.string().required(),
  totalSlots: Joi.number().min(0).default(0)
});

const suspensionSchema = Joi.object({
  doctorId: Joi.string().required(),
  date: Joi.string().required(),
  startTime: Joi.string().required(),
  endTime: Joi.string().required(),
  reason: Joi.string().allow('', null).optional()
});

const queryScheduleSchema = Joi.object({
  doctorId: Joi.string().optional(),
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),
  type: Joi.string().valid('regular', 'temporary', 'suspension').optional()
});

export {
  weeklyScheduleSchema,
  temporaryScheduleSchema,
  suspensionSchema,
  queryScheduleSchema
};
