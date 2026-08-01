import { Router } from 'express';
import { getPublicProfileHandler } from './profile.controller.js';

// Deliberately no requireAuth — same reasoning as gallery.routes.js: a
// logged-out visitor should be able to view a public profile.
const router = Router();

router.get('/:id', getPublicProfileHandler);

export default router;
