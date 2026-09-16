import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { PublicLayout } from './layouts/PublicLayout.js';

import {
  AboutPage,
  FaqPage,
  LandingPage,
} from '../features/public/PublicPages.js';
import { SystemStatusPage } from '../features/system/SystemPages.js';
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
import { NotificationCenterPage } from '../features/notifications/NotificationCenterPage.js';

const RoleLayout = lazy(() =>
  import('./layouts/RoleLayout.js').then((module) => ({
    default: module.RoleLayout,
  })),
);

const AuthLayout = lazy(() =>
  import('./layouts/AuthLayout.js').then((module) => ({
    default: module.AuthLayout,
  })),
);

// Load feature screens on demand without changing route nesting or access guards.
const ContactPage = lazy(() =>
  import('../features/public/ContactPage.js').then((module) => ({
    default: module.ContactPage,
  })),
);

const ChangePasswordPage = lazy(() =>
  import('../features/auth/AuthPages.js').then((module) => ({
    default: module.ChangePasswordPage,
  })),
);

const ForgotPasswordPage = lazy(() =>
  import('../features/auth/AuthPages.js').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

const LoginPage = lazy(() =>
  import('../features/auth/AuthPages.js').then((module) => ({
    default: module.LoginPage,
  })),
);

const RegisterPage = lazy(() =>
  import('../features/auth/AuthPages.js').then((module) => ({
    default: module.RegisterPage,
  })),
);

const ResetPasswordPage = lazy(() =>
  import('../features/auth/AuthPages.js').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);

const ProfilePage = lazy(() =>
  import('../features/users/UserPages.js').then((module) => ({
    default: module.ProfilePage,
  })),
);

const AdminUserListPage = lazy(() =>
  import('../features/users/AdminUserManagementPages.js').then((module) => ({
    default: module.AdminUserListPage,
  })),
);

const TrainerEditorPage = lazy(() =>
  import('../features/users/AdminUserManagementPages.js').then((module) => ({
    default: module.TrainerEditorPage,
  })),
);

const CataloguePage = lazy(() =>
  import('../features/trainings/TrainingPages.js').then((module) => ({
    default: module.CataloguePage,
  })),
);

const TrainingDetailPage = lazy(() =>
  import('../features/trainings/TrainingPages.js').then((module) => ({
    default: module.TrainingDetailPage,
  })),
);

const CategoryManagementPage = lazy(() =>
  import('../features/trainings/TrainingManagementPages.js').then((module) => ({
    default: module.CategoryManagementPage,
  })),
);

const TrainingEditorPage = lazy(() =>
  import('../features/trainings/TrainingManagementPages.js').then((module) => ({
    default: module.TrainingEditorPage,
  })),
);

const TrainingManagementListPage = lazy(() =>
  import('../features/trainings/TrainingManagementPages.js').then((module) => ({
    default: module.TrainingManagementListPage,
  })),
);

const ContentPage = lazy(() =>
  import('../features/content/ContentPage.js').then((module) => ({
    default: module.ContentPage,
  })),
);

const SessionCreatePage = lazy(() =>
  import('../features/sessions/SessionPages.js').then((module) => ({
    default: module.SessionCreatePage,
  })),
);

const SessionManagementPage = lazy(() =>
  import('../features/sessions/SessionPages.js').then((module) => ({
    default: module.SessionManagementPage,
  })),
);

const CheckoutReturnPage = lazy(() =>
  import('../features/payments/PaymentPages.js').then((module) => ({
    default: module.CheckoutReturnPage,
  })),
);

const PaymentCenterPage = lazy(() =>
  import('../features/payments/PaymentPages.js').then((module) => ({
    default: module.PaymentCenterPage,
  })),
);

const ProgressPage = lazy(() =>
  import('../features/progress/ProgressPage.js').then((module) => ({
    default: module.ProgressPage,
  })),
);

const AttendancePage = lazy(() =>
  import('../features/attendance/AttendancePage.js').then((module) => ({
    default: module.AttendancePage,
  })),
);

const EvaluationCreatePage = lazy(() =>
  import('../features/evaluations/EvaluationPage.js').then((module) => ({
    default: module.EvaluationCreatePage,
  })),
);

const EvaluationPage = lazy(() =>
  import('../features/evaluations/EvaluationPage.js').then((module) => ({
    default: module.EvaluationPage,
  })),
);

const CertificateFeedbackPage = lazy(() =>
  import('../features/certificates/CertificateFeedbackPage.js').then(
    (module) => ({ default: module.CertificateFeedbackPage }),
  ),
);

const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage.js').then((module) => ({
    default: module.DashboardPage,
  })),
);

const CookiePolicyPage = lazy(() =>
  import('../features/legal/LegalPages.js').then((module) => ({
    default: module.CookiePolicyPage,
  })),
);

const DataDeletionPage = lazy(() =>
  import('../features/legal/LegalPages.js').then((module) => ({
    default: module.DataDeletionPage,
  })),
);

const PrivacyPolicyPage = lazy(() =>
  import('../features/legal/LegalPages.js').then((module) => ({
    default: module.PrivacyPolicyPage,
  })),
);

const RefundPolicyPage = lazy(() =>
  import('../features/legal/LegalPages.js').then((module) => ({
    default: module.RefundPolicyPage,
  })),
);

const TermsPage = lazy(() =>
  import('../features/legal/LegalPages.js').then((module) => ({
    default: module.TermsPage,
  })),
);

const LearnerDashboard = lazy(() =>
  import('../features/dashboard/RoleDashboards.js').then((module) => ({
    default: module.LearnerDashboard,
  })),
);

const RoleIndexRedirect = lazy(() =>
  import('../features/dashboard/RoleDashboards.js').then((module) => ({
    default: module.RoleIndexRedirect,
  })),
);

const TrainerDashboard = lazy(() =>
  import('../features/dashboard/RoleDashboards.js').then((module) => ({
    default: module.TrainerDashboard,
  })),
);

export function App() {
  return (
    <>
      <ScrollToTop />
      <DocumentTitle />
      <BackToTop />
      <AnalyticsPageTracker />
      <AnalyticsConsentBanner />
      <Suspense
        fallback={
          <p className="content-card" role="status">
            Chargement...
          </p>
        }
      >
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="/catalogue" element={<CataloguePage />} />
            <Route path="/trainings/:id" element={<TrainingDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
          </Route>
          <Route
            path="/status/authentication-required"
            element={<SystemStatusPage kind="authentication-required" />}
          />
          <Route
            path="/status/forbidden"
            element={<SystemStatusPage kind="forbidden" />}
          />
          <Route
            path="/status/server-error"
            element={<SystemStatusPage kind="server-error" />}
          />
          <Route
            path="/status/unavailable"
            element={<SystemStatusPage kind="unavailable" />}
          />
          <Route
            path="/status/session-expired"
            element={<SystemStatusPage kind="session-expired" />}
          />
          <Route
            path="/status/rate-limited"
            element={<SystemStatusPage kind="rate-limited" />}
          />
          <Route
            path="/status/account-unavailable"
            element={<SystemStatusPage kind="account-unavailable" />}
          />
          <Route
            path="/status/resource-unavailable"
            element={<SystemStatusPage kind="resource-unavailable" />}
          />
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
              <Route path="notifications" element={<NotificationCenterPage />} />
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
              <Route
                path="evaluations/:evaluationId"
                element={<EvaluationPage />}
              />
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
          <Route path="*" element={<SystemStatusPage kind="not-found" />} />
        </Routes>
      </Suspense>
    </>
  );
}
