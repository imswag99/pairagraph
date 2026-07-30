import { api } from './api.js';

export const matchmakingService = {
  join: (writingType, theme) => api.post('/matchmaking/quick-match', { writingType, theme }),
  status: () => api.get('/matchmaking/quick-match'),
  cancel: () => api.del('/matchmaking/quick-match'),
};
