import { param, validationResult } from 'express-validator';
import ApiError from '../../utils/ApiError.js';

export const validateUuid = [
  param('uuid').isUUID(4).withMessage('Invalid UUID format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join(', ');
      return next(new ApiError(400, message));
    }
    next();
  },
];
