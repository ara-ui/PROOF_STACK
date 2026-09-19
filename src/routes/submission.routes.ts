import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as submissionController from '../controllers/submission.controller';

export const submissionRouter = Router();

submissionRouter.post('/submissions', asyncHandler(submissionController.create));
submissionRouter.get('/submissions/:id', asyncHandler(submissionController.getById));
