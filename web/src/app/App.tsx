import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Providers } from './providers';
import { RequireAdmin, RequireStudent } from './guards';
import { Loading, EmptyState } from '../components/Feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Page } from '../components/Page';
import { ar } from '../i18n/ar';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/quiz/HomePage';
import { PlayPage } from '../features/quiz/PlayPage';
import { WriterPage } from '../features/assignments/WriterPage';

// Admin code is split out so students never download it.
const AdminRoutes = lazy(() => import('../features/admin/AdminRoutes'));

export function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireStudent />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/quiz/:id" element={<PlayPage />} />
              <Route path="/write/:id" element={<WriterPage />} />
            </Route>
            <Route path="/admin/*" element={<RequireAdmin><Suspense fallback={<Loading />}><AdminRoutes /></Suspense></RequireAdmin>} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Page><EmptyState title={ar.errors.notFoundPage} icon="🧭" /></Page>} />
          </Routes>
        </BrowserRouter>
      </Providers>
    </ErrorBoundary>
  );
}
