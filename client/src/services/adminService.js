import { api } from './api.js';

export const adminService = {
  listUsers: () => api.get('/admin/users'),
  banUser: (id) => api.patch(`/admin/users/${id}/ban`),
  unbanUser: (id) => api.patch(`/admin/users/${id}/unban`),
  deleteUser: (id) => api.del(`/admin/users/${id}`),
  getCollaboration: (id) => api.get(`/admin/collaborations/${id}`),
  unpublishCollaboration: (id) => api.patch(`/admin/collaborations/${id}/unpublish`),
};
