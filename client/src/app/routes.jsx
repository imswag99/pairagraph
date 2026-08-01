import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../sockets/socket.js';

// Lazy per route rather than static imports — HomePage alone doesn't need
// Tiptap, jsPDF, or framer-motion, but every one of those loaded upfront
// before this split since they're only reachable from other pages' code.
// Pages only have named exports, so each dynamic import is remapped to the
// default-export shape React.lazy requires, rather than adding a default
// export to every single page file just for this.
const namedLazy = (importFn, exportName) => lazy(() => importFn().then((m) => ({ default: m[exportName] })));

const HomePage = namedLazy(() => import('../pages/HomePage.jsx'), 'HomePage');
const VerifyEmailPage = namedLazy(() => import('../pages/VerifyEmailPage.jsx'), 'VerifyEmailPage');
const CollaborationPage = namedLazy(() => import('../pages/CollaborationPage.jsx'), 'CollaborationPage');
const CollaborationsPage = namedLazy(() => import('../pages/CollaborationsPage.jsx'), 'CollaborationsPage');
const LeaderboardPage = namedLazy(() => import('../pages/LeaderboardPage.jsx'), 'LeaderboardPage');
const GalleryPage = namedLazy(() => import('../pages/GalleryPage.jsx'), 'GalleryPage');
const GalleryItemPage = namedLazy(() => import('../pages/GalleryItemPage.jsx'), 'GalleryItemPage');
const ProfilePage = namedLazy(() => import('../pages/ProfilePage.jsx'), 'ProfilePage');
const InvitePage = namedLazy(() => import('../pages/InvitePage.jsx'), 'InvitePage');
const ResetPasswordPage = namedLazy(() => import('../pages/ResetPasswordPage.jsx'), 'ResetPasswordPage');
const AccountPage = namedLazy(() => import('../pages/AccountPage.jsx'), 'AccountPage');
const PrivacyPolicyPage = namedLazy(() => import('../pages/PrivacyPolicyPage.jsx'), 'PrivacyPolicyPage');
const TermsOfServicePage = namedLazy(() => import('../pages/TermsOfServicePage.jsx'), 'TermsOfServicePage');
const AdminReportsPage = namedLazy(() => import('../pages/AdminReportsPage.jsx'), 'AdminReportsPage');
const AdminUsersPage = namedLazy(() => import('../pages/AdminUsersPage.jsx'), 'AdminUsersPage');
const NotFoundPage = namedLazy(() => import('../pages/NotFoundPage.jsx'), 'NotFoundPage');

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-charcoal/50">
      Loading…
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="/collaborations" element={<CollaborationsPage />} />
        <Route path="/collaborations/:id" element={<CollaborationPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/discover" element={<GalleryPage />} />
        <Route path="/discover/:id" element={<GalleryItemPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/admin" element={<AdminReportsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
