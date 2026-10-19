import { createBrowserRouter, Navigate } from 'react-router';
import { PortalLayout } from '../components/layout/PortalLayout';
import { AdminApprovalsPage } from '../features/admin/AdminApprovalsPage';
import { AdminAuditPage } from '../features/admin/AdminAuditPage';
import { AdminEventsPage } from '../features/admin/AdminEventsPage';
import { AdminHomePage } from '../features/admin/AdminHomePage';
import { AdminKycPage } from '../features/admin/AdminKycPage';
import { AdminPayoutsPage } from '../features/admin/AdminPayoutsPage';
import { AdminReconciliationPage } from '../features/admin/AdminReconciliationPage';
import { AdminReportsPage } from '../features/admin/AdminReportsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { WorkspacePickerPage } from '../features/auth/WorkspacePickerPage';
import { OrgEventsPage } from '../features/org/OrgEventsPage';
import { OrgFinancePage } from '../features/org/OrgFinancePage';
import { OrgGatesPage } from '../features/org/OrgGatesPage';
import { OrgHomePage } from '../features/org/OrgHomePage';
import { OrgOrdersPage } from '../features/org/OrgOrdersPage';
import { OrgReportsPage } from '../features/org/OrgReportsPage';
import { OrgStaffPage } from '../features/org/OrgStaffPage';
import { OrgVenuesPage } from '../features/org/OrgVenuesPage';
import { RequireWorkspace } from './RequireWorkspace';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/workspaces', element: <WorkspacePickerPage /> },
  {
    path: '/org',
    element: (
      <RequireWorkspace kind="ORG">
        <PortalLayout />
      </RequireWorkspace>
    ),
    children: [
      { index: true, element: <OrgHomePage /> },
      { path: 'events', element: <OrgEventsPage /> },
      { path: 'venues', element: <OrgVenuesPage /> },
      { path: 'staff', element: <OrgStaffPage /> },
      { path: 'gates', element: <OrgGatesPage /> },
      { path: 'orders', element: <OrgOrdersPage /> },
      { path: 'finance', element: <OrgFinancePage /> },
      { path: 'reports', element: <OrgReportsPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireWorkspace kind="ADMIN">
        <PortalLayout />
      </RequireWorkspace>
    ),
    children: [
      { index: true, element: <AdminHomePage /> },
      { path: 'kyc', element: <AdminKycPage /> },
      { path: 'events', element: <AdminEventsPage /> },
      { path: 'approvals', element: <AdminApprovalsPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'payouts', element: <AdminPayoutsPage /> },
      { path: 'reconciliation', element: <AdminReconciliationPage /> },
      { path: 'audit', element: <AdminAuditPage /> },
    ],
  },
]);
