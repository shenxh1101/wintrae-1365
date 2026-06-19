import Joi from 'joi';

export const lockSlotSchema = {
  body: Joi.object({
    slotId: Joi.string().required(),
    patientName: Joi.string().required(),
    patientPhone: Joi.string().required()
  })
};

export const confirmSchema = {
  body: Joi.object({
    slotId: Joi.string().required(),
    patientName: Joi.string().required(),
    patientPhone: Joi.string().required()
  })
};

export const cancelSchema = {
  body: Joi.object({
    reason: Joi.string().required()
  })
};

export const rescheduleSchema = {
  body: Joi.object({
    newSlotId: Joi.string().required(),
    reason: Joi.string().required()
  })
};

export const noShowSchema = {
  body: Joi.object({
    reason: Joi.string().required()
  })
};

export const queryAppointmentSchema = {
  query: Joi.object({
    doctorId: Joi.string().optional(),
    patientPhone: Joi.string().optional(),
    status: Joi.string().optional(),
    startDate: Joi.string().optional(),
    endDate: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(10)
  })
};
