import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JournalPage from './pages/JournalPage';
import EntriesPage from './pages/EntriesPage';
import EntryDetailPage from './pages/EntryDetailPage';
import ConnectionsPage from './pages/ConnectionsPage';
import BridgeViewPage from './pages/BridgeViewPage';
import InsightsPage from './pages/InsightsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import CirclesPage from './pages/CirclesPage';
import CircleViewPage from './pages/CircleViewPage';
import CreateCirclePage from './pages/CreateCirclePage';
import PrivacyPage from './pages/PrivacyPage';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout/Layout';
import OnboardingInterview from './components/Onboarding/OnboardingInterview';

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useSelector(state => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect to onboarding if not completed
  if (user && !user.onboardingComplete && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useSelector(state => state.auth);
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — public, no auth, shown to everyone */}
        <Route path="/welcome" element={<LandingPage />} />

        {/* Public routes */}
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute><RegisterPage /></PublicRoute>
        } />
        {/* Privacy policy — public, no auth required */}
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Onboarding (protected but no layout) */}
        <Route path="/onboarding" element={
          <ProtectedRoute><OnboardingInterview /></ProtectedRoute>
        } />

        {/* Protected routes with layout */}
        <Route path="/" element={
          <ProtectedRoute><Layout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="/journal" replace />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="entries" element={<EntriesPage />} />
          <Route path="entry/:id" element={<EntryDetailPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="circles" element={<CirclesPage />} />
          <Route path="circles/new" element={<CreateCirclePage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="welcome" element={<LandingPage />} />
        </Route>

        {/* Bridge view (full screen, no sidebar) */}
        <Route path="/bridge/:connectionId" element={
          <ProtectedRoute><BridgeViewPage /></ProtectedRoute>
        } />

        {/* Circle view (full screen) */}
        <Route path="/circles/:id" element={
          <ProtectedRoute><CircleViewPage /></ProtectedRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
