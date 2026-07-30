import { api } from './api.js';

export const galleryService = {
  list: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    ).toString();
    return api.get(`/gallery${query ? `?${query}` : ''}`);
  },
  get: (id) => api.get(`/gallery/${id}`),
};
