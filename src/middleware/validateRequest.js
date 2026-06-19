import Joi from 'joi';
import { fail, HttpCode } from '../utils/response.js';

export function validateRequest(schemas) {
  return (req, res, next) => {
    const errors = [];

    if (schemas.params) {
      const { error } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => d.message));
      }
    }

    if (schemas.query) {
      const { error } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => d.message));
      }
    }

    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => d.message));
      }
    }

    if (errors.length > 0) {
      return res.status(HttpCode.BAD_REQUEST).json(
        fail(errors.join('; '), HttpCode.BAD_REQUEST)
      );
    }

    next();
  };
}

export { Joi };
