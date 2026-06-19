import Joi from 'joi';

export const joinWaitlistSchema = {
  body: Joi.object({
    slotId: Joi.string().required(),
    patientName: Joi.string().required(),
    patientPhone: Joi.string().required()
  })
};

export const cancelWaitlistSchema = {
  params: Joi.object({
    id: Joi.string().required()
  })
};

export const queryWaitlistSchema = {
  query: Joi.object({
    doctorId: Joi.string().optional(),
    patientPhone: Joi.string().optional(),
    status: Joi.string().valid('waiting', 'notification_sent', 'confirmed', 'cancelled', 'expired').optional(),
    date: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(10)
  })
};
