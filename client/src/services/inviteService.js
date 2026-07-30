import { api } from './api.js';

export const inviteService = {
  create: (writingType, theme) => api.post('/invites', { writingType, theme }),
  redeem: (code) => api.post(`/invites/${code}/redeem`),
  cancel: (id) => api.del(`/invites/${id}`),
  listMine: () => api.get('/invites'),
};
