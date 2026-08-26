export type GuestStackParamList = {
  Catalogue: undefined;
  TrainingDetail: { trainingId: string };
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

export type AppStackParamList = {
  Workspace: undefined;
  Catalogue: undefined;
  TrainingDetail: { trainingId: string };
  ManagedTrainings: undefined;
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
};

export type PasswordStackParamList = {
  ChangePassword: undefined;
  ResetPassword: { token?: string };
};
