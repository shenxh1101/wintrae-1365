import Joi from 'joi';

const weeklyScheduleSchema = Joi.object({
  doctorId: Joi.string().required(),
  startDate: Joi.string().required(),
  dailySchedules: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().min(0).max(6).required(),
      startTime: Joi.string().required(),
      endTime: Joi.string().required(),
      totalSlots: Joi.number().min(1).required()
    })
  ).min(1).required()
});

const temporaryScheduleSchema = Joi.object({
  doctorId: Joi.string().required(),
  date: Joi.string().required(),
  startTime: Joi.string().required(),
  endTime: Joi.string().required(),
  totalSlots: Joi.number().min(1).required(),
  type: Joi.string().valid('regular', 'temporary').default('temporary')
});

const queryScheduleSchema = Joi.object({
  doctorId: Joi.string().optional(),
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional()
});

export {
  weeklyScheduleSchema,
  temporaryScheduleSchema,
  queryScheduleSchema
};
