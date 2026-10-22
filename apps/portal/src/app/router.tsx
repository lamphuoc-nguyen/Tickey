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
import { AuthFlowsPage } from '../features/auth/AuthFlowsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { WorkspacePickerPage } from '../features/auth/WorkspacePickerPage';
import { OrgEventsPage } from '../features/org/OrgEventsPage';
import { OrgFinancePage } from '../features/org/OrgFinancePage';
import { OrgGatesPage } from '../features/org/OrgGatesPage';
import { OrgHomePage } from '../features/org/OrgHomePage';
import { OrgOnboardingPage } from '../features/org/OrgOnboardingPage';
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
  { path: '/workspace', element: <Navigate to="/workspaces" replace /> },
  { path: '/mfa', element: <AuthFlowsPage defaultScreen="w-mfa" /> },
  { path: '/mfa-setup', element: <AuthFlowsPage defaultScreen="w-mfa-setup" /> },
  { path: '/mfa-admin', element: <AuthFlowsPage defaultScreen="w-mfa-admin" /> },
  { path: '/verify', element: <AuthFlowsPage defaultScreen="w-verify" /> },
  { path: '/forgot-password', element: <AuthFlowsPage defaultScreen="w-forgot" /> },
  { path: '/forgot', element: <AuthFlowsPage defaultScreen="w-forgot" /> },
  { path: '/reset-password', element: <AuthFlowsPage defaultScreen="w-reset" /> },
  { path: '/reset', element: <AuthFlowsPage defaultScreen="w-reset" /> },
  {
    path: '/org',
    element: (
      <RequireWorkspace kind="ORG">
        <PortalLayout />
      </RequireWorkspace>
    ),
    children: [
      { index: true, element: <OrgHomePage /> },
      { path: 'onboarding', element: <OrgOnboardingPage /> },
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
      { path: 'venues', element: <Navigate to="/admin/kyc?tab=venues" replace /> },
      { path: 'events', element: <AdminEventsPage /> },
      { path: 'approvals', element: <AdminApprovalsPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'payouts', element: <AdminPayoutsPage /> },
      { path: 'reconciliation', element: <AdminReconciliationPage /> },
      { path: 'audit', element: <AdminAuditPage /> },
    ],
  },
  // Unknown paths: back to sign-in (which forwards a signed-in user) instead of the router's error page.
  { path: '*', element: <Navigate to="/login" replace /> },
]);
