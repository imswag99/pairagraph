import { api } from './api.js';

export const profileService = {
  get: (id) => api.get(`/profiles/${id}`),
};
