import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { WRITING_TYPES, THEMES } from '../collaboration/collaboration.constants.js';
import * as inviteService from './invite.service.js';

export const createInviteHandler = asyncHandler(async (req, res) => {
  const { writingType } = req.body;
  const theme = req.body.theme ?? 'classic';
  if (!WRITING_TYPES.includes(writingType)) {
    throw new ApiError(400, "writingType must be 'story' or 'poem'");
  }
  if (!THEMES.includes(theme)) {
    throw new ApiError(400, `theme must be one of: ${THEMES.join(', ')}`);
  }

  const invite = await inviteService.createInvite(req.user.id, writingType, theme);
  res.status(201).json({
    success: true,
    data: {
      invite: {
        id: invite._id,
        writingType: invite.writingType,
        theme: invite.theme,
        code: invite.code,
        status: invite.status,
      },
    },
  });
});

export const redeemInviteHandler = asyncHandler(async (req, res) => {
  const result = await inviteService.redeemInvite(req.user.id, req.params.code);
  res.json({ success: true, data: result });
});

export const cancelInviteHandler = asyncHandler(async (req, res) => {
  await inviteService.cancelInvite(req.user.id, req.params.id);
  res.json({ success: true, message: 'Invite cancelled' });
});

export const listMineHandler = asyncHandler(async (req, res) => {
  const invites = await inviteService.getMine(req.user.id);
  res.json({ success: true, data: { invites } });
});
