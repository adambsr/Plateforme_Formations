import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { ApiError, apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
const registrationSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

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
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">Plateforme de Formations</span>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
            navigate(user.mustChangePassword ? '/change-password' : '/app', {
              replace: true,
            });
          } catch (caught) {
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
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            required
            {...form.register('password')}
          />
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
          Se connecter
        </button>
      </form>
      <div className="auth-links">
        <Link to="/forgot-password">Mot de passe oublié ?</Link>
        <Link to="/register">Créer un compte Apprenant</Link>
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
            await register(parsed.data);
            navigate('/app', { replace: true });
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
        <label>
          Mot de passe
          <input
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
            {...form.register('password')}
          />
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
      <div className="auth-links">
        <Link to="/login">J’ai déjà un compte</Link>
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
  const token = parameters.get('token');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<{ newPassword: string }>();
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
          onSubmit={form.handleSubmit(async ({ newPassword }) => {
            setError('');
            try {
              await apiRequest('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword }),
              });
              setComplete(true);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          })}
        >
          <label>
            Nouveau mot de passe
            <input
              type="password"
              minLength={8}
              required
              {...form.register('newPassword')}
            />
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
  const form = useForm<{ currentPassword: string; newPassword: string }>();
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
          try {
            await changePassword(values.currentPassword, values.newPassword);
            navigate('/app', { replace: true });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <label>
          Mot de passe actuel
          <input
            type="password"
            required
            {...form.register('currentPassword')}
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            type="password"
            minLength={8}
            required
            {...form.register('newPassword')}
          />
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
          Enregistrer
        </button>
      </form>
    </AuthCard>
  );
}
