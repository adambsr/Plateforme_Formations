import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { CalendarClock, Mail, MapPin, Send } from 'lucide-react';
import { apiRequest } from '../../core/api/client.js';

export function ContactPage() {
  const [submissionError, setSubmissionError] = useState('');
  const [submissionNotice, setSubmissionNotice] = useState('');
  const form = useForm<{
    name: string;
    email: string;
    subject: string;
    message: string;
  }>();
  const address =
    import.meta.env.VITE_CENTER_ADDRESS ??
    'Route Manzel Chaker km 2.5 en face Magasin Général (MG) , Sfax, Tunisia';
  const email = import.meta.env.VITE_CENTER_EMAIL ?? 'contact.hsa.tn@gmail.com';
  const phone = import.meta.env.VITE_CENTER_PHONE ?? '+216 70 000 000';
  const hours =
    import.meta.env.VITE_CENTER_HOURS ?? 'Lundi-vendredi, 8 h 30-17 h 30';
  return (
    <section className="static-page contact-page">
      <div className="contact-intro">
        <span className="eyebrow">Contact</span>
        <h1>Parlons de votre projet de formation.</h1>
        <p className="lead">
          Pour toute question sur un parcours, une session ou votre espace,
          notre équipe vous répond avec les informations utiles, sans jamais
          demander de mot de passe ou de données de carte.
        </p>
        <dl className="contact-details">
          <div>
            <dt>
              <MapPin aria-hidden="true" size={16} /> Adresse
            </dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt>
              <Mail aria-hidden="true" size={16} /> Email
            </dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>
              <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
            </dd>
          </div>
          <div>
            <dt>
              <CalendarClock aria-hidden="true" size={16} /> Horaires
            </dt>
            <dd>{hours}</dd>
          </div>
        </dl>
        <Link className="secondary-button" to="/catalogue">
          Consulter le catalogue
        </Link>
      </div>
      <form
        className="content-card contact-form"
        onSubmit={form.handleSubmit(async (values) => {
          setSubmissionError('');
          setSubmissionNotice('');
          try {
            const result = await apiRequest<{ message: string }>('/contact', {
              method: 'POST',
              body: JSON.stringify(values),
            });
            setSubmissionNotice(result.message);
            form.reset();
          } catch (caught) {
            setSubmissionError(
              caught instanceof Error
                ? caught.message
                : 'Votre message n’a pas pu être envoyé.',
            );
          }
        })}
      >
        <h2>Envoyer un message</h2>
        <p className="muted">Tous les champs sont obligatoires.</p>
        <label>
          Nom
          <input required minLength={2} {...form.register('name')} />
        </label>
        <label>
          Email
          <input type="email" required {...form.register('email')} />
        </label>
        <label>
          Objet
          <input required minLength={3} {...form.register('subject')} />
        </label>
        <label>
          Message
          <textarea
            rows={5}
            required
            minLength={10}
            {...form.register('message')}
          />
        </label>
        <p className="muted">
          Votre nom, votre email, l’objet et le message sont transmis à notre
          équipe par email pour répondre à votre demande. Consultez notre{' '}
          <Link to="/privacy">politique de confidentialité</Link>.
        </p>
        {submissionError && (
          <p className="form-error" role="alert">
            {submissionError}
          </p>
        )}
        {submissionNotice && (
          <p className="success-message" role="status">
            {submissionNotice}
          </p>
        )}
        <button
          className="primary-button"
          disabled={form.formState.isSubmitting}
        >
          <Send aria-hidden="true" size={17} />
          {form.formState.isSubmitting ? 'Envoi…' : 'Envoyer le message'}
        </button>
      </form>
    </section>
  );
}
