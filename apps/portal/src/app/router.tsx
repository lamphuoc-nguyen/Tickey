import { createBrowserRouter, Navigate } from 'react-router';
import { AdminHomePage } from '../features/admin/AdminHomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { WorkspacePickerPage } from '../features/auth/WorkspacePickerPage';
import { OrgHomePage } from '../features/org/OrgHomePage';
import { RequireWorkspace } from './RequireWorkspace';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/workspaces" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/workspaces', element: <WorkspacePickerPage /> },
  {
    path: '/org/*',
    element: (
      <RequireWorkspace kind="ORG">
        <OrgHomePage />
      </RequireWorkspace>
    ),
  },
  {
    path: '/admin/*',
    element: (
      <RequireWorkspace kind="ADMIN">
        <AdminHomePage />
      </RequireWorkspace>
    ),
  },
]);
