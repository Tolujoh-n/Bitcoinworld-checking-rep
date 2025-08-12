import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import ProtectedRoute from './components/common/ProtectedRoute';

// Lazy load components for better performance
const Layout = React.lazy(() => import('./components/layout/Layout'));
const Home = React.lazy(() => import('./pages/Home'));
const Politics = React.lazy(() => import('./pages/categories/Politics'));
const MiddleEast = React.lazy(() => import('./pages/categories/MiddleEast'));
const Crypto = React.lazy(() => import('./pages/categories/Crypto'));
const Tech = React.lazy(() => import('./pages/categories/Tech'));
const Culture = React.lazy(() => import('./pages/categories/Culture'));
const World = React.lazy(() => import('./pages/categories/World'));
const Economy = React.lazy(() => import('./pages/categories/Economy'));
const Sports = React.lazy(() => import('./pages/categories/Sports'));
const Elections = React.lazy(() => import('./pages/categories/Elections'));
const Trending = React.lazy(() => import('./pages/categories/Trending'));
const PollDetail = React.lazy(() => import('./pages/PollDetail'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Admin = React.lazy(() => import('./pages/Admin'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function App() {
  const { loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'dark' : ''}`}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark' : ''}`}>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="politics" element={<Politics />} />
            <Route path="middle-east" element={<MiddleEast />} />
            <Route path="crypto" element={<Crypto />} />
            <Route path="tech" element={<Tech />} />
            <Route path="culture" element={<Culture />} />
            <Route path="world" element={<World />} />
            <Route path="economy" element={<Economy />} />
            <Route path="sports" element={<Sports />} />
            <Route path="elections" element={<Elections />} />
            <Route path="trending" element={<Trending />} />
            <Route path="poll/:id" element={<PollDetail />} />
            <Route 
              path="profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin/*" 
              element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
