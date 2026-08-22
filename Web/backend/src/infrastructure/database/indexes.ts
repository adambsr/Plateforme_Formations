import { PasswordResetTokenModel } from '../../modules/auth/models/password-reset-token.model.js';
import { RefreshSessionModel } from '../../modules/auth/models/refresh-session.model.js';
import { UserModel } from '../../modules/users/models/user.model.js';
import { TrainingCategoryModel } from '../../modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../../modules/trainings/models/training.model.js';
import { LessonModel } from '../../modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../../modules/content/models/training-module.model.js';
import { TrainingResourceModel } from '../../modules/content/models/training-resource.model.js';
import { SessionScheduleModel } from '../../modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../../modules/sessions/models/training-session.model.js';
import { PaymentModel } from '../../modules/payments/models/payment.model.js';
import { EnrollmentModel } from '../../modules/enrollments/models/enrollment.model.js';
import { InvoiceModel } from '../../modules/invoices/models/invoice.model.js';
import { InvoiceItemModel } from '../../modules/invoices/models/invoice-item.model.js';
import { LessonProgressModel } from '../../modules/progress/models/lesson-progress.model.js';
import { AttendanceModel } from '../../modules/attendance/models/attendance.model.js';
import { EvaluationModel } from '../../modules/evaluations/models/evaluation.model.js';
import { EvaluationQuestionModel } from '../../modules/evaluations/models/evaluation-question.model.js';
import { EvaluationAttemptModel } from '../../modules/evaluations/models/evaluation-attempt.model.js';
import { EvaluationAnswerModel } from '../../modules/evaluations/models/evaluation-answer.model.js';
import { CertificateModel } from '../../modules/certificates/models/certificate.model.js';
import { FeedbackModel } from '../../modules/feedback/models/feedback.model.js';
import { TrainerCostModel } from '../../modules/costs/models/trainer-cost.model.js';
import { TrainingCostModel } from '../../modules/costs/models/training-cost.model.js';

export async function initializeDatabaseIndexes(): Promise<void> {
  await Promise.all([
    UserModel.init(),
    RefreshSessionModel.init(),
    PasswordResetTokenModel.init(),
    TrainingCategoryModel.init(),
    TrainingModel.init(),
    TrainingModuleModel.init(),
    LessonModel.init(),
    TrainingResourceModel.init(),
    TrainingSessionModel.init(),
    SessionScheduleModel.init(),
    PaymentModel.init(),
    EnrollmentModel.init(),
    InvoiceModel.init(),
    InvoiceItemModel.init(),
    LessonProgressModel.init(),
    AttendanceModel.init(),
    EvaluationModel.init(),
    EvaluationQuestionModel.init(),
    EvaluationAttemptModel.init(),
    EvaluationAnswerModel.init(),
    CertificateModel.init(),
    FeedbackModel.init(),
    TrainerCostModel.init(),
    TrainingCostModel.init(),
  ]);
}
