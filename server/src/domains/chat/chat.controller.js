import { asyncHandler } from '../../utils/asyncHandler.js';
import * as chatService from './chat.service.js';

export const sendMessageHandler = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const message = await chatService.sendMessage(req.user.id, req.params.collaborationId, content);
  res.status(201).json({ success: true, data: { message } });
});

export const getHistoryHandler = asyncHandler(async (req, res) => {
  const { before, limit } = req.query;
  const result = await chatService.getHistory(req.user.id, req.params.collaborationId, {
    before,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ success: true, data: result });
});
