import { api } from './api.js';

export const collaborationService = {
  getMine: () => api.get('/collaborations'),
  getById: (id) => api.get(`/collaborations/${id}`),
  submitTurn: (id, content) => api.post(`/collaborations/${id}/turns`, { content }),
  respondToCompletion: (id, approve) => api.post(`/collaborations/${id}/completion`, { approve }),
};
