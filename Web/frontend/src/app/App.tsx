import { Navigate, Route, Routes } from 'react-router';

import {
  ChangePasswordPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from '../features/auth/AuthPages.js';
import { ProfilePage } from '../features/users/UserPages.js';
import {
  AdminUserListPage,
  TrainerEditorPage,
} from '../features/users/AdminUserManagementPages.js';
import {
  CataloguePage,
  TrainingDetailPage,
} from '../features/trainings/TrainingPages.js';
import {
  CategoryManagementPage,
  TrainingEditorPage,
  TrainingManagementListPage,
} from '../features/trainings/TrainingManagementPages.js';
import { ContentPage } from '../features/content/ContentPage.js';
import {
  SessionCreatePage,
  SessionManagementPage,
} from '../features/sessions/SessionPages.js';
import {
  CheckoutReturnPage,
  PaymentCenterPage,
} from '../features/payments/PaymentPages.js';
import { RoleLayout } from './layouts/RoleLayout.js';
import { ProgressPage } from '../features/progress/ProgressPage.js';
import { AttendancePage } from '../features/attendance/AttendancePage.js';
import {
  EvaluationCreatePage,
  EvaluationPage,
} from '../features/evaluations/EvaluationPage.js';
import { CertificateFeedbackPage } from '../features/certificates/CertificateFeedbackPage.js';
import { DashboardPage } from '../features/dashboard/DashboardPage.js';
import { PublicLayout } from './layouts/PublicLayout.js';
import { AuthLayout } from './layouts/AuthLayout.js';
import {
  AboutPage,
  ContactPage,
  FaqPage,
  LandingPage,
} from '../features/public/PublicPages.js';
import {
  LearnerDashboard,
  RoleIndexRedirect,
  TrainerDashboard,
} from '../features/dashboard/RoleDashboards.js';
import {
  PublicOnly,
  RequireAuthentication,
  RequireRole,
} from './routes/guards.js';
import { ScrollToTop } from '../shared/components/ScrollToTop.js';
import { BackToTop } from '../shared/components/BackToTop.js';
import { DocumentTitle } from '../shared/components/DocumentTitle.js';
import { AnalyticsPageTracker } from '../core/analytics/AnalyticsPageTracker.js';
import { AnalyticsConsentBanner } from '../core/analytics/AnalyticsConsentBanner.js';

export function App() {
  return (
    <>
      <ScrollToTop />
      <DocumentTitle />
      <BackToTop />
      <AnalyticsPageTracker />
      <AnalyticsConsentBanner />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/trainings/:id" element={<TrainingDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
        <Route element={<PublicOnly />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>
        <Route element={<RequireAuthentication />}>
          <Route path="/payments/success" element={<CheckoutReturnPage />} />
          <Route
            path="/payments/cancel"
            element={<CheckoutReturnPage cancelled />}
          />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/app" element={<RoleLayout />}>
            <Route index element={<RoleIndexRedirect />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="catalogue" element={<CataloguePage embedded />} />
            <Route element={<RequireRole roles={['ADMIN', 'TRAINER']} />}>
              <Route
                path="trainings"
                element={<TrainingManagementListPage />}
              />
              <Route path="trainings/new" element={<TrainingEditorPage />} />
              <Route
                path="trainings/:trainingId/edit"
                element={<TrainingEditorPage />}
              />
              <Route
                path="trainings/:trainingId/content"
                element={<ContentPage />}
              />
              <Route path="sessions" element={<SessionManagementPage />} />
              <Route path="sessions/new" element={<SessionCreatePage />} />
            </Route>
            <Route path="content/:trainingId" element={<ContentPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="evaluations" element={<EvaluationPage />} />
            <Route element={<RequireRole roles={['TRAINER']} />}>
              <Route
                path="evaluations/new"
                element={<EvaluationCreatePage />}
              />
            </Route>
            <Route
              path={'certificates'}
              element={<CertificateFeedbackPage />}
            />
            <Route element={<RequireRole roles={['LEARNER']} />}>
              <Route path="learner" element={<LearnerDashboard />} />
              <Route path="progress" element={<ProgressPage />} />
            </Route>
            <Route element={<RequireRole roles={['TRAINER']} />}>
              <Route path="trainer" element={<TrainerDashboard />} />
            </Route>
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="categories" element={<CategoryManagementPage />} />
              <Route path="users" element={<AdminUserListPage />} />
              <Route
                path="users/trainers/new"
                element={<TrainerEditorPage />}
              />
              <Route
                path="users/trainers/:trainerId/edit"
                element={<TrainerEditorPage />}
              />
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
            <Route element={<RequireRole roles={['ADMIN', 'LEARNER']} />}>
              <Route path="payments" element={<PaymentCenterPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
