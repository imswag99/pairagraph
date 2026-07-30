import { asyncHandler } from '../../utils/asyncHandler.js';
import * as galleryService from './gallery.service.js';

export const listPublishedHandler = asyncHandler(async (req, res) => {
  const { page, limit, writingType, theme } = req.query;
  const result = await galleryService.listPublished({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    writingType,
    theme,
  });
  res.json({ success: true, data: result });
});

export const getPublishedHandler = asyncHandler(async (req, res) => {
  const piece = await galleryService.getPublished(req.params.id);
  res.json({ success: true, data: { piece } });
});
