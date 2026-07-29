import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as collaborationService from './collaboration.service.js';

export const listMineHandler = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await collaborationService.getMine(req.user.id, {
    status,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result });
});

export const getTurnCountHandler = asyncHandler(async (req, res) => {
  const count = await collaborationService.getTurnCount(req.user.id);
  res.json({ success: true, data: { count } });
});

export const getOneHandler = asyncHandler(async (req, res) => {
  const collaboration = await collaborationService.getById(req.user.id, req.params.id);
  res.json({ success: true, data: { collaboration } });
});

export const submitTurnHandler = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const collaboration = await collaborationService.submitTurn(req.user.id, req.params.id, content);
  res.json({ success: true, data: { collaboration } });
});

export const respondToCompletionHandler = asyncHandler(async (req, res) => {
  const { approve } = req.body;
  if (typeof approve !== 'boolean') {
    throw new ApiError(400, 'approve must be a boolean');
  }
  const collaboration = await collaborationService.respondToCompletion(
    req.user.id,
    req.params.id,
    approve
  );
  res.json({ success: true, data: { collaboration } });
});

export const leaveHandler = asyncHandler(async (req, res) => {
  const collaboration = await collaborationService.leave(req.user.id, req.params.id);
  res.json({ success: true, data: { collaboration } });
});
