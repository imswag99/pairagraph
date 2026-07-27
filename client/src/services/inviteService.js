import { api } from './api.js';

export const inviteService = {
  create: (writingType) => api.post('/invites', { writingType }),
  redeem: (code) => api.post(`/invites/${code}/redeem`),
  cancel: (id) => api.del(`/invites/${id}`),
  listMine: () => api.get('/invites'),
};
