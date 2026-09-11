export type LegalKind =
  'privacy' | 'terms' | 'cookies' | 'refunds' | 'deletion';
export type StatusKind =
  | 'not-found'
  | 'authentication-required'
  | 'forbidden'
  | 'server-error'
  | 'unavailable'
  | 'session-expired'
  | 'account-unavailable'
  | 'resource-unavailable';

export type GuestStackParamList = {
  Home: undefined;
  Catalogue: undefined;
  TrainingDetail: { trainingId: string };
  About: undefined;
  Faq: undefined;
  Contact: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  Legal: { kind: LegalKind };
  Status: { kind: StatusKind };
  NotFound: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Workspace: undefined;
  Catalogue: undefined;
  TrainingDetail: { trainingId: string };
  ManagedTrainings: undefined;
  TrainingCreate: undefined;
  Content: { trainingId: string };
  Progress: undefined;
  Sessions: undefined;
  SessionDetail: { sessionId: string };
  SessionManage: { sessionId?: string } | undefined;
  Attendance: undefined;
  Purchases: undefined;
  CheckoutReturn: { paymentId?: string; result?: string };
  ResetPassword: { token?: string };
  Evaluations: undefined;
  EvaluationCreate: undefined;
  Certificates: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminCosts: undefined;
  AdminCategories: undefined;
  Profile: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  Legal: { kind: LegalKind };
  Status: { kind: StatusKind };
  NotFound: undefined;
};

export type PasswordStackParamList = {
  ChangePassword: undefined;
  ResetPassword: { token?: string };
};
