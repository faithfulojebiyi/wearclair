import * as Joi from 'joi';

export const REQUIRED_STRING_SCHEMA = Joi.string().required();

export const REQUIRED_NUMBER_SCHEMA = Joi.number().required();

export const REQUIRED_BOOLEAN_SCHEMA = Joi.boolean().required();

// Top-level `Joi.when` — not `Joi.string().when`. The base string schema rejects
// `KEY=` before the conditional branch runs; dev optional keys must accept empty.
export const OPTIONAL_STRING_IN_DEV_SCHEMA = Joi.when('APP_ENV', {
  is: Joi.valid('development'),
  then: Joi.string().empty('').optional(),
  otherwise: Joi.string().required(),
});

export const OPTIONAL_NUMBER_IN_DEV_SCHEMA = Joi.number().when('APP_ENV', {
  is: Joi.valid('development'),
  then: Joi.optional(),
  otherwise: Joi.required(),
});

export const OPTIONAL_BOOLEAN_IN_DEV_SCHEMA = Joi.boolean().when('APP_ENV', {
  is: Joi.valid('development'),
  then: Joi.optional(),
  otherwise: Joi.required(),
});
