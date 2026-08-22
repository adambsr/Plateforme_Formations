import { Navigate, Route, Routes } from 'react-router';

import {
  ChangePasswordPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from '../features/auth/AuthPages.js';
import {
  AdminUsersPage,
  ProfilePage,
  RoleHomePage,
} from '../features/users/UserPages.js';
import {
  CataloguePage,
  TrainingDetailPage,
  TrainingManagementPage,
} from '../features/trainings/TrainingPages.js';
import { ContentPage } from '../features/content/ContentPage.js';
import { SessionManagementPage } from '../features/sessions/SessionPages.js';
import {
  CheckoutReturnPage,
  PaymentCenterPage,
} from '../features/payments/PaymentPages.js';
import { RoleLayout } from './layouts/RoleLayout.js';
import { ProgressPage } from '../features/progress/ProgressPage.js';
import { AttendancePage } from '../features/attendance/AttendancePage.js';
import { EvaluationPage } from '../features/evaluations/EvaluationPage.js';
import { CertificateFeedbackPage } from '../features/certificates/CertificateFeedbackPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import {
  PublicOnly,
  RequireAuthentication,
  RequireRole,
} from './routes/guards.js';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/catalogue" element={<CataloguePage />} />
      <Route path="/trainings/:id" element={<TrainingDetailPage />} />
      <Route element={<RequireAuthentication />}>
        <Route path="/payments/success" element={<CheckoutReturnPage />} />
        <Route
          path="/payments/cancel"
          element={<CheckoutReturnPage cancelled />}
        />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/app" element={<RoleLayout />}>
          <Route index element={<RoleHomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="catalogue" element={<CataloguePage embedded />} />
          <Route element={<RequireRole roles={['ADMIN', 'TRAINER']} />}>
            <Route path="trainings" element={<TrainingManagementPage />} />
            <Route
              path="trainings/:trainingId/content"
              element={<ContentPage />}
            />
            <Route path="sessions" element={<SessionManagementPage />} />
          </Route>
          <Route path="content/:trainingId" element={<ContentPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="evaluations" element={<EvaluationPage />} />
          <Route path={'certificates'} element={<CertificateFeedbackPage />} />
          <Route element={<RequireRole roles={['LEARNER']} />}>
            <Route path="progress" element={<ProgressPage />} />
          </Route>
          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<RequireRole roles={['ADMIN', 'LEARNER']} />}>
            <Route path="payments" element={<PaymentCenterPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
