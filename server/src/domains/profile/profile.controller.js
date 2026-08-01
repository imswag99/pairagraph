import { asyncHandler } from '../../utils/asyncHandler.js';
import * as profileService from './profile.service.js';

export const getPublicProfileHandler = asyncHandler(async (req, res) => {
  const profile = await profileService.getPublicProfile(req.params.id);
  res.json({ success: true, data: { profile } });
});
