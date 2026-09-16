import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { z } from 'zod';

import { ApiError, apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { roleHomePath } from '../../app/routes/destinations.js';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
const registrationSchema = credentialsSchema
  .extend({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    confirmPassword: z.string().min(8),
    acceptTerms: z.literal(true),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe doivent correspondre.',
  });

export function PasswordInput({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-control">
        <input {...props} type={visible ? 'text' : 'password'} />
        <button
          type="button"
          aria-label={
            visible
              ? `Masquer ${label.toLowerCase()}`
              : `Afficher ${label.toLowerCase()}`
          }
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function AuthCard({
  title,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <div className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">High Skills Academy</span>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const form = useForm<{ email: string; password: string }>();
  return (
    <AuthCard
      title="Bienvenue"
      subtitle="Connectez-vous avec votre compte centre de formation."
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError('');
          const parsed = credentialsSchema.safeParse(values);
          if (!parsed.success) {
            setError(
              'Saisissez un email valide et un mot de passe d’au moins 8 caractères.',
            );
            return;
          }
          try {
            const user = await login(parsed.data.email, parsed.data.password);
            const requestedPath = (location.state as { from?: string } | null)
              ?.from;
            navigate(
              user.mustChangePassword
                ? '/change-password'
                : requestedPath?.startsWith('/')
                  ? requestedPath
                  : roleHomePath(user.role),
              {
                replace: true,
              },
            );
          } catch (caught) {
            if (
              caught instanceof ApiError &&
              caught.code === 'ACCOUNT_UNAVAILABLE'
            ) {
              navigate('/status/account-unavailable');
              return;
            }
            setError(errorMessage(caught));
          }
        })}
      >
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            {...form.register('email')}
          />
        </label>
        <PasswordInput
          label="Mot de passe"
          autoComplete="current-password"
          required
          {...form.register('password')}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={form.formState.isSubmitting}
        >
          Se connecter
        </button>
      </form>
      <div className="auth-links auth-actions">
        <Link className="link-button" to="/forgot-password">
          Mot de passe oublié ?
        </Link>
        <Link className="secondary-button" to="/register">
          Créer un compte Apprenant
        </Link>
      </div>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof registrationSchema>>();
  return (
    <AuthCard
      title="Créer un compte Apprenant"
      subtitle="L’inscription publique crée exclusivement un compte Apprenant."
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError('');
          const parsed = registrationSchema.safeParse(values);
          if (!parsed.success) {
            setError('Vérifiez les informations saisies.');
            return;
          }
          try {
            await register({
              email: parsed.data.email,
              password: parsed.data.password,
              firstName: parsed.data.firstName,
              lastName: parsed.data.lastName,
            });
            navigate(roleHomePath('LEARNER'), { replace: true });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <div className="form-grid">
          <label>
            Prénom
            <input required {...form.register('firstName')} />
          </label>
          <label>
            Nom
            <input required {...form.register('lastName')} />
          </label>
        </div>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            {...form.register('email')}
          />
        </label>
        <PasswordInput
          label="Mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
          {...form.register('password')}
        />
        <PasswordInput
          label="Confirmer le mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
          {...form.register('confirmPassword')}
        />
        <p className="registration-data-notice">
          Nous utilisons votre nom et votre email pour créer votre compte,
          fournir les formations et envoyer les messages opérationnels liés au
          service. Aucun abonnement marketing n’est créé.
        </p>
        <label className="consent-control">
          <input type="checkbox" required {...form.register('acceptTerms')} />
          <span>
            J’accepte les{' '}
            <Link to="/terms" target="_blank">
              Conditions générales
            </Link>{' '}
            et reconnais avoir lu la{' '}
            <Link to="/privacy" target="_blank">
              Politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={form.formState.isSubmitting}
        >
          Créer mon compte
        </button>
      </form>
      <div className="auth-links auth-actions">
        <Link className="secondary-button" to="/login">
          J’ai déjà un compte
        </Link>
      </div>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<{ email: string }>();
  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Nous enverrons un lien si un compte actif correspond à cet email."
    >
      {sent ? (
        <p className="success-message">
          La demande a été prise en compte. Consultez votre boîte email.
        </p>
      ) : (
        <form
          onSubmit={form.handleSubmit(async ({ email }) => {
            setError('');
            try {
              await apiRequest('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
              });
              setSent(true);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          })}
        >
          <label>
            Email
            <input type="email" required {...form.register('email')} />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            disabled={form.formState.isSubmitting}
          >
            Envoyer les instructions
          </button>
        </form>
      )}
      <div className="auth-links">
        <Link to="/login">Retour à la connexion</Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [parameters] = useSearchParams();
  const [token] = useState(() => parameters.get('token'));
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<{ newPassword: string; confirmPassword: string }>();
  useEffect(() => {
    if (token === null || typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', '/reset-password');
  }, [token]);
  if (complete) return <Navigate to="/login" replace />;
  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe d’au moins 8 caractères."
    >
      {token === null ? (
        <p className="form-error">Le lien de réinitialisation est incomplet.</p>
      ) : (
        <form
          onSubmit={form.handleSubmit(
            async ({ newPassword, confirmPassword }) => {
              setError('');
              if (newPassword !== confirmPassword) {
                setError('Les mots de passe doivent correspondre.');
                return;
              }
              try {
                await apiRequest('/auth/reset-password', {
                  method: 'POST',
                  body: JSON.stringify({ token, newPassword }),
                });
                setComplete(true);
              } catch (caught) {
                setError(errorMessage(caught));
              }
            },
          )}
        >
          <PasswordInput
            label="Nouveau mot de passe"
            minLength={8}
            autoComplete="new-password"
            required
            {...form.register('newPassword')}
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            minLength={8}
            autoComplete="new-password"
            required
            {...form.register('confirmPassword')}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            disabled={form.formState.isSubmitting}
          >
            Réinitialiser
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const form = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();
  if (user === null) return <Navigate to="/login" replace />;
  return (
    <AuthCard
      title="Modifier votre mot de passe"
      subtitle={
        user.mustChangePassword
          ? 'Le mot de passe temporaire doit être remplacé avant de continuer.'
          : 'Cette opération déconnecte vos autres sessions.'
      }
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError('');
          if (values.newPassword !== values.confirmPassword) {
            setError('Les mots de passe doivent correspondre.');
            return;
          }
          try {
            await changePassword(values.currentPassword, values.newPassword);
            navigate(roleHomePath(user.role), { replace: true });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <PasswordInput
          label="Mot de passe actuel"
          autoComplete="current-password"
          required
          {...form.register('currentPassword')}
        />
        <PasswordInput
          label="Nouveau mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
          {...form.register('newPassword')}
        />
        <PasswordInput
          label="Confirmer le mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
          {...form.register('confirmPassword')}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={form.formState.isSubmitting}
        >
          Enregistrer
        </button>
      </form>
    </AuthCard>
  );
}
