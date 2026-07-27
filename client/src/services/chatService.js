import { api } from './api.js';

export const chatService = {
  getHistory: (collaborationId, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/collaborations/${collaborationId}/chat${query ? `?${query}` : ''}`);
  },
  sendMessage: (collaborationId, content) =>
    api.post(`/collaborations/${collaborationId}/chat`, { content }),
};
