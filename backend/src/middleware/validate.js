import Joi from 'joi';
import { unprocessable } from '../utils/errors.js';
import { isValidDateKey } from '../utils/time.js';

// Pesan validasi Joi dalam Bahasa Indonesia agar ramah untuk kasir.
const messages = {
  'any.required': '{{#label}} wajib diisi',
  'any.only': '{{#label}} harus salah satu dari {{#valids}}',
  'any.invalid': '{{#label}} tidak valid',
  'string.base': '{{#label}} harus berupa teks',
  'string.empty': '{{#label}} tidak boleh kosong',
  'string.min': '{{#label}} minimal {{#limit}} karakter',
  'string.max': '{{#label}} maksimal {{#limit}} karakter',
  'string.pattern.base': '{{#label}} formatnya tidak valid',
  'number.base': '{{#label}} harus berupa angka',
  'number.integer': '{{#label}} harus bilangan bulat',
  'number.min': '{{#label}} minimal {{#limit}}',
  'number.max': '{{#label}} maksimal {{#limit}}',
  'number.positive': '{{#label}} harus lebih dari 0',
  'array.base': '{{#label}} harus berupa daftar',
  'array.min': '{{#label}} minimal berisi {{#limit}} item',
  'array.max': '{{#label}} maksimal berisi {{#limit}} item',
  'array.unique': '{{#label}} tidak boleh ada yang sama',
  'boolean.base': '{{#label}} harus ya/tidak',
  'date.base': '{{#label}} harus berupa tanggal yang valid',
  'object.unknown': '{{#label}} tidak dikenali',
  'dateKey.invalid': '{{#label}} harus berformat YYYY-MM-DD',
};

export const J = Joi.defaults((schema) => schema.options({ messages }));

/** Joi custom untuk 'YYYY-MM-DD' */
export const dateKey = () =>
  J.string().custom((value, helpers) => {
    if (!isValidDateKey(value)) return helpers.error('dateKey.invalid');
    return value;
  });

/**
 * Middleware validasi. `schemas` = { body?, query?, params? }.
 * Hasil yang sudah dibersihkan disimpan di req.valid.
 */
export const validate = (schemas) => (req, _res, next) => {
  const errors = {};
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const { value, error } = schemas[part].validate(req[part] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
      errors: { wrap: { label: false } },
    });
    if (error) {
      for (const d of error.details) {
        const key = d.path.join('.') || part;
        if (!errors[key]) errors[key] = d.message;
      }
    } else {
      req.valid[part] = value;
    }
  }
  if (Object.keys(errors).length) {
    const first = Object.values(errors)[0];
    return next(unprocessable(`Data belum lengkap atau tidak valid: ${first}.`, errors));
  }
  next();
};
