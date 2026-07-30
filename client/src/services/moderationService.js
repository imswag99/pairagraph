import { api } from './api.js';

export const moderationService = {
  reportUser: (collaborationId, reason, details) =>
    api.post('/moderation/reports', { collaborationId, reason, details }),
  reportGalleryContent: (collaborationId, reason, details) =>
    api.post('/moderation/gallery-reports', { collaborationId, reason, details }),
  blockUser: (collaborationId) => api.post('/moderation/blocks', { collaborationId }),
  unblockUser: (userId) => api.del(`/moderation/blocks/${userId}`),
  getBlockedUsers: () => api.get('/moderation/blocks'),
  listReports: () => api.get('/moderation/reports'),
  markReportReviewed: (id) => api.patch(`/moderation/reports/${id}`),
};
