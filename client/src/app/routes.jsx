import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../sockets/socket.js';
import { HomePage } from '../pages/HomePage.jsx';
import { VerifyEmailPage } from '../pages/VerifyEmailPage.jsx';
import { CollaborationPage } from '../pages/CollaborationPage.jsx';
import { CollaborationsPage } from '../pages/CollaborationsPage.jsx';
import { LeaderboardPage } from '../pages/LeaderboardPage.jsx';
import { InvitePage } from '../pages/InvitePage.jsx';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.jsx';
import { AccountPage } from '../pages/AccountPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

export function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    socket.connect();

    function goToCollaboration({ collaborationId }) {
      navigate(`/collaborations/${collaborationId}`);
    }

    socket.on('matchmaking:matched', goToCollaboration);
    socket.on('invite:redeemed', goToCollaboration);

    return () => {
      socket.off('matchmaking:matched', goToCollaboration);
      socket.off('invite:redeemed', goToCollaboration);
      socket.disconnect();
    };
  }, [isAuthenticated, navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="/collaborations" element={<CollaborationsPage />} />
      <Route path="/collaborations/:id" element={<CollaborationPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
