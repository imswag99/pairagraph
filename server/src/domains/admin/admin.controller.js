import { asyncHandler } from '../../utils/asyncHandler.js';
import * as adminService from './admin.service.js';

export const listUsersHandler = asyncHandler(async (req, res) => {
  const users = await adminService.listUsers();
  res.json({ success: true, data: { users } });
});

export const banUserHandler = asyncHandler(async (req, res) => {
  await adminService.banUser(req.user.id, req.params.id);
  res.json({ success: true, message: 'User banned' });
});

export const unbanUserHandler = asyncHandler(async (req, res) => {
  await adminService.unbanUser(req.params.id);
  res.json({ success: true, message: 'User unbanned' });
});

export const deleteUserHandler = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.user.id, req.params.id);
  res.json({ success: true, message: 'User deleted' });
});

export const getReportedCollaborationHandler = asyncHandler(async (req, res) => {
  const result = await adminService.getReportedCollaboration(req.params.id);
  res.json({ success: true, data: result });
});

export const unpublishCollaborationHandler = asyncHandler(async (req, res) => {
  await adminService.unpublishCollaboration(req.params.id);
  res.json({ success: true, message: 'Collaboration unpublished' });
});
