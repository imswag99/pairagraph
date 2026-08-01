import { Router } from 'express';
import { requireAuth } from './auth.middleware.js';
import {
  registerHandler,
  verifyEmailHandler,
  loginHandler,
  googleLoginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  updateProfileHandler,
  setProfileVisibilityHandler,
  changePasswordHandler,
  deleteAccountHandler,
} from './auth.controller.js';

const router = Router();

router.post('/register', registerHandler);
router.get('/verify-email/:token', verifyEmailHandler);
router.post('/login', loginHandler);
router.post('/google', googleLoginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', requireAuth, meHandler);
router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password/:token', resetPasswordHandler);
router.patch('/me', requireAuth, updateProfileHandler);
router.patch('/me/profile-visibility', requireAuth, setProfileVisibilityHandler);
router.post('/me/change-password', requireAuth, changePasswordHandler);
router.delete('/me', requireAuth, deleteAccountHandler);

export default router;
