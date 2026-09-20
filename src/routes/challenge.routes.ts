import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as challengeController from '../controllers/challenge.controller';

export const challengeRouter = Router();

challengeRouter.get('/challenges', asyncHandler(challengeController.list));
challengeRouter.get('/challenges/:slug', asyncHandler(challengeController.getBySlug));
