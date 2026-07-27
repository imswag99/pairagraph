import { api } from './api.js';

export const matchmakingService = {
  join: (writingType) => api.post('/matchmaking/quick-match', { writingType }),
  status: () => api.get('/matchmaking/quick-match'),
  cancel: () => api.del('/matchmaking/quick-match'),
};
