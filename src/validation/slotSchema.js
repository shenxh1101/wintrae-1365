import Joi from 'joi';

const generateSlotsSchema = Joi.object({
  scheduleId: Joi.string().required(),
  durationMinutes: Joi.number().min(1).default(30)
});

const querySlotSchema = Joi.object({
  doctorId: Joi.string().optional(),
  date: Joi.string().optional(),
  status: Joi.string().valid('available', 'locked', 'booked', 'cancelled').optional()
});

export {
  generateSlotsSchema,
  querySlotSchema
};
