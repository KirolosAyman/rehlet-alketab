import { useQueryClient } from '@tanstack/react-query';
import { Outlet, Route, Routes } from 'react-router-dom';
import { ar } from '../../i18n/ar';
import { api } from '../../lib/api';
import { adminToken } from '../../lib/session';
import { Button } from '../../components/Button';
import { Page } from '../../components/Page';
import { NavTabs } from '../../components/Tabs';
import { EmptyState } from '../../components/Feedback';
import { DashboardPage } from './DashboardPage';
import { QuizzesPage } from './QuizzesPage';
import { QuizEditorPage } from './QuizEditorPage';
import { QuizResultsPage } from './QuizResultsPage';
import { UnlockPage } from './UnlockPage';
import { AssignmentsPage } from './AssignmentsPage';
import { BooksPage } from './BooksPage';
import { StudentsPage } from './StudentsPage';
import { SettingsPage } from './SettingsPage';

function Layout() {
  const qc = useQueryClient();
  const logout = async () => {
    try { await api('admin_logout'); } catch { /* token is cleared anyway */ }
    adminToken.clear();
    qc.removeQueries({ queryKey: ['admin'] });
  };
  const t = ar.admin.tabs;
  return (
    <Page wide actions={<Button variant="ghost" small onClick={logout}>{ar.logout}</Button>}>
      <NavTabs
        label={ar.admin.loginTitle}
        links={[['/admin', t.dashboard, true], ['/admin/quizzes', t.quizzes], ['/admin/books', t.books], ['/admin/assignments', t.assignments], ['/admin/students', t.students], ['/admin/settings', t.settings]]}
      />
      <Outlet />
    </Page>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="quizzes" element={<QuizzesPage />} />
        <Route path="quizzes/new" element={<QuizEditorPage />} />
        <Route path="quizzes/:id/edit" element={<QuizEditorPage />} />
        <Route path="quizzes/:id" element={<QuizResultsPage />} />
        <Route path="quizzes/:id/unlock" element={<UnlockPage />} />
        <Route path="books" element={<BooksPage />} />
        <Route path="books/:id" element={<BooksPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<EmptyState title={ar.errors.notFoundPage} icon="🧭" />} />
      </Route>
    </Routes>
  );
}
