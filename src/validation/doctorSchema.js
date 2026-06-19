import Joi from 'joi';

const createDoctorSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': '姓名不能为空'
  }),
  department: Joi.string().required().messages({
    'any.required': '科室不能为空'
  }),
  title: Joi.string().required().messages({
    'any.required': '职称不能为空'
  }),
  phone: Joi.string().required().messages({
    'any.required': '电话不能为空'
  })
});

const updateDoctorSchema = Joi.object({
  name: Joi.string(),
  department: Joi.string(),
  title: Joi.string(),
  phone: Joi.string(),
  status: Joi.string().valid('active', 'inactive')
});

const queryDoctorSchema = Joi.object({
  department: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10)
});

export { createDoctorSchema, updateDoctorSchema, queryDoctorSchema };
