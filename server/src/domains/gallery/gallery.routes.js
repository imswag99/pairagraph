import { Router } from 'express';
import { listPublishedHandler, getPublishedHandler } from './gallery.controller.js';

// Deliberately no requireAuth anywhere in this file — the whole point of
// discovery is that a logged-out visitor can browse published work.
const router = Router();

router.get('/', listPublishedHandler);
router.get('/:id', getPublishedHandler);

export default router;
