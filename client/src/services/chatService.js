import { api } from './api.js';

export const chatService = {
  getHistory: (collaborationId) => api.get(`/collaborations/${collaborationId}/chat`),
  sendMessage: (collaborationId, content) =>
    api.post(`/collaborations/${collaborationId}/chat`, { content }),
};
