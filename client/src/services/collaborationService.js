import { api } from './api.js';

export const collaborationService = {
  getMine: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/collaborations${query ? `?${query}` : ''}`);
  },
  getTurnCount: () => api.get('/collaborations/turn-count'),
  getById: (id) => api.get(`/collaborations/${id}`),
  submitTurn: (id, content) => api.post(`/collaborations/${id}/turns`, { content }),
  respondToCompletion: (id, approve) => api.post(`/collaborations/${id}/completion`, { approve }),
  leave: (id) => api.post(`/collaborations/${id}/leave`),
  setPublished: (id, published) => api.patch(`/collaborations/${id}/publish`, { published }),
  setPublishConsent: (id, consent) =>
    api.patch(`/collaborations/${id}/publish-consent`, { consent }),
};
