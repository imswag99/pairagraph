import { api } from './api.js';

export const leaderboardService = {
  get: (range) => api.get(`/leaderboard?range=${range}`),
};
