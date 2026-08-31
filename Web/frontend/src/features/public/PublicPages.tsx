import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { CalendarClock, Mail, MapPin, Send } from 'lucide-react';
import badgeCheckIcon from 'lucide-static/icons/badge-check.svg';
import bookOpenCheckIcon from 'lucide-static/icons/book-open-check.svg';
import brainCircuitIcon from 'lucide-static/icons/brain-circuit.svg';
import briefcaseBusinessIcon from 'lucide-static/icons/briefcase-business.svg';
import calendarClockIcon from 'lucide-static/icons/calendar-clock.svg';
import codeIcon from 'lucide-static/icons/code-2.svg';
import fileSpreadsheetIcon from 'lucide-static/icons/file-spreadsheet.svg';
import paletteIcon from 'lucide-static/icons/palette.svg';

import academyHero from '../../assets/academy-hero.png';
import { apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Icon } from '../../shared/components/Icon.js';
import { TrainingCard } from '../trainings/TrainingPages.js';
import type {
  PaginatedTrainings,
  TrainingCategory,
} from '../trainings/types.js';

export function LandingPage() {
  const { user } = useAuth();
  const [preview, setPreview] = useState<PaginatedTrainings>();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  useEffect(() => {
    let active = true;
    void apiRequest<PaginatedTrainings>('/trainings?page=1&pageSize=3')
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch(() => {
        if (active) setPreview({ items: [], page: 1, pageSize: 3, total: 0 });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void apiRequest<TrainingCategory[]>('/categories')
      .then((value) => {
        if (active) setCategories(value.slice(0, 5));
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">Apprendre. Progresser. Réussir.</span>
          <h1>La formation qui avance avec vous.</h1>
          <p>
            Découvrez des parcours professionnels accessibles en ligne ou en
            présentiel, suivez votre progression et valorisez vos acquis par un
            certificat.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/catalogue">
              Explorer les formations
            </Link>
            {user === null ? (
              <Link className="secondary-button" to="/register">
                Créer mon compte
              </Link>
            ) : null}
          </div>
          <dl className="hero-proof">
            <div>
              <dt>2 modalités</dt>
              <dd>En ligne et présentiel</dd>
            </div>
            <div>
              <dt>Suivi clair</dt>
              <dd>Progression et planning</dd>
            </div>
            <div>
              <dt>Certificats</dt>
              <dd>Après validation des acquis</dd>
            </div>
          </dl>
        </div>
        <figure className="hero-visual">
          <img
            src={academyHero}
            alt="Apprenants accompagnés par une formatrice dans une salle moderne"
          />
          <figcaption className="hero-image-caption">
            <strong>Apprendre ensemble</strong>
            <span>Des parcours concrets, en ligne et en présentiel.</span>
          </figcaption>
          {/* <div className="hero-card hero-card-one">
            <Icon src={bookOpenCheckIcon} size={22} />
            <strong>À votre rythme</strong>
            <span>Progression claire</span>
          </div>
          <div className="hero-card hero-card-two">
            <Icon src={calendarClockIcon} size={22} />
            <strong>Planning maîtrisé</strong>
            <span>Sessions en présentiel</span>
          </div> */}
        </figure>
      </section>
      <section className="landing-section">
        <div className="section-copy">
          <div>
            <span className="eyebrow">Une expérience complète</span>
            <h2>
              Tout ce qu’il faut pour transformer une inscription en compétences.
            </h2>
          </div>
        </div>
        <div className="feature-grid">
          <article>
            <Icon src={bookOpenCheckIcon} size={32} className="feature-icon" />
            <h3>Parcours structurés</h3>
            <p>
              Modules, leçons et ressources organisés pour avancer sans perdre
              le fil.
            </p>
          </article>
          <article>
            <Icon src={calendarClockIcon} size={32} className="feature-icon" />
            <h3>Sessions maîtrisées</h3>
            <p>
              Dates, salles, formateurs et présences réunis dans un planning
              lisible.
            </p>
          </article>
          <article>
            <Icon src={badgeCheckIcon} size={32} className="feature-icon" />
            <h3>Résultats vérifiables</h3>
            <p>
              Évaluations, progression et certificats reposent sur des règles
              transparentes.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-section category-showcase">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Domaines</span>
            <h2>Explorez par catégorie</h2>
          </div>
          <Link className="tertiary-link" to="/catalogue">
            Parcourir le catalogue <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="category-tiles">
          {(categories.length > 0
            ? categories
            : [
                { id: 'web', name: 'Développement web' },
                { id: 'data', name: 'Data & IA' },
                { id: 'management', name: 'Management' },
                { id: 'design', name: 'Design numérique' },
              ]
          ).map((category, index) => {
            const categoryIcon = [
              fileSpreadsheetIcon,
              brainCircuitIcon,
              paletteIcon,
              codeIcon,
              briefcaseBusinessIcon,
            ][index % 5]!;
            return (
              <Link key={category.id} to="/catalogue">
                <Icon src={categoryIcon} size={26} />
                <strong>{category.name}</strong>
                <small>Découvrir les parcours</small>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="landing-section landing-training-preview">
        <div className="section-heading">
          <div>
            <span className="eyebrow">À découvrir</span>
            <h2>Formations publiées</h2>
          </div>
          <Link className="tertiary-link" to="/catalogue">
            Voir tout le catalogue <span aria-hidden="true">→</span>
          </Link>
        </div>
        {preview === undefined ? (
          <div className="skeleton-grid" aria-label="Chargement des formations">
            <span />
            <span />
            <span />
          </div>
        ) : preview.items.length === 0 ? (
          <div className="empty-state">
            <h3>De nouveaux parcours arrivent bientôt.</h3>
            <Link className="secondary-button" to="/catalogue">
              Consulter le catalogue
            </Link>
          </div>
        ) : (
          <div className="training-grid landing-training-grid">
            {preview.items.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                headingLevel={3}
              />
            ))}
          </div>
        )}
      </section>
      <section className="landing-section testimonial-section">
        <div className="section-copy">
          <div>
            <span className="eyebrow">Retours de démonstration</span>
            <h2>Une expérience pensée pour rester simple.</h2>
            <p className="muted">
              Témoignages fictifs affichés uniquement pour illustrer la version de
              développement.
            </p>
          </div>
        </div>
        <div className="testimonial-grid">
          {[
            [
              'Ahmed',
              'Apprenant',
              'Une expérience très simple pour trouver ma formation et reprendre mes leçons.',
            ],
            [
              'Meriem',
              'Apprenante',
              'Le planning et les étapes à valider sont immédiatement compréhensibles.',
            ],
            [
              'Sami',
              'Formateur',
              'Je retrouve mes contenus, sessions et évaluations sans détour.',
            ],
          ].map(([name, role, quote]) => (
            <figure key={name}>
              <div aria-label="5 étoiles">★★★★★</div>
              <blockquote>« {quote} »</blockquote>
              <figcaption>
                — {name}, {role} · Démo
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="landing-section how-section">
        <div>
          <span className="eyebrow">Comment ça marche</span>
          <h2>Un parcours simple, du choix au certificat.</h2>
        </div>
        <ol>
          <li>
            <strong>Choisissez</strong>
            <span>Explorez les formations publiées.</span>
          </li>
          <li>
            <strong>Inscrivez-vous</strong>
            <span>Créez votre compte Apprenant.</span>
          </li>
          <li>
            <strong>Progressez</strong>
            <span>Suivez les contenus ou votre planning.</span>
          </li>
          <li>
            <strong>Validez</strong>
            <span>Réussissez les étapes requises.</span>
          </li>
        </ol>
      </section>
      <section className="landing-cta">
        <div>
          <span className="eyebrow">Prêt à commencer ?</span>
          <h2>Construisez votre prochain savoir-faire.</h2>
          <p>
            Votre espace personnel centralise formations, progression,
            paiements, évaluations et certificats.
          </p>
        </div>
        {user === null ? (
          <Link className="primary-button" to="/register">
            Créer mon compte
          </Link>
        ) : null}
      </section>
    </>
  );
}

export function AboutPage() {
  return (
    <section className="static-page">
      <span className="eyebrow">À propos</span>
      <h1>La formation professionnelle, rendue plus lisible.</h1>
      <p className="lead">
        La plateforme accompagne un centre de formation dans la diffusion de
        parcours en ligne et l’organisation de sessions en présentiel.
      </p>
      <div className="feature-grid">
        <article>
          <h2>Pour les Apprenants</h2>
          <p>
            Un seul espace pour apprendre, consulter son planning, passer ses
            évaluations et retrouver ses documents.
          </p>
        </article>
        <article>
          <h2>Pour les Formateurs</h2>
          <p>
            Des outils concentrés sur le contenu pédagogique, les sessions, les
            présences et les résultats.
          </p>
        </article>
        <article>
          <h2>Pour le centre</h2>
          <p>
            Une vision cohérente des utilisateurs, formations, inscriptions et
            indicateurs d’activité.
          </p>
        </article>
      </div>
    </section>
  );
}

const questions = [
  [
    'Puis-je créer un compte Formateur ?',
    'Non. Les comptes Formateurs sont créés exclusivement par l’Admin du centre.',
  ],
  [
    'Quelle différence entre en ligne et présentiel ?',
    'La formation en ligne se suit à votre rythme avec modules et leçons. En présentiel, vous choisissez une session avec des dates et un lieu.',
  ],
  [
    'Quand puis-je obtenir mon certificat ?',
    'Après avoir satisfait les conditions de progression, de présence et d’évaluation applicables à votre formation.',
  ],
  [
    'Le paiement est-il confirmé par le site ?',
    'La confirmation provient du prestataire de paiement et du backend sécurisé, jamais d’un simple affichage dans le navigateur.',
  ],
] as const;
export function FaqPage() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(questions[0][0]);
  return (
    <section className="static-page faq-page">
      <span className="eyebrow">Questions fréquentes</span>
      <h1>Les réponses avant de commencer.</h1>
      <div className="faq-list">
        {questions.map(([question, answer]) => (
          <article
            className={openQuestion === question ? 'faq-item is-open' : 'faq-item'}
            key={question}
          >
            <button
              type="button"
              aria-expanded={openQuestion === question}
              onClick={() => setOpenQuestion((current) => current === question ? null : question)}
            >
              {question}
            </button>
            <div className="faq-answer"><p>{answer}</p></div>
          </article>
        ))}
      </div>
      <div className="inline-cta">
        <p>Vous ne trouvez pas votre réponse ?</p>
        <Link className="primary-button" to="/contact">
          Nous contacter
        </Link>
      </div>
    </section>
  );
}
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
    import.meta.env.VITE_CENTER_ADDRESS ?? 'Route Manzel Chaker km 2.5 en face Magasin Général (MG) , Sfax, Tunisia';
  const email = import.meta.env.VITE_CENTER_EMAIL ?? 'highskills.ac@gmail.com';
  const phone = import.meta.env.VITE_CENTER_PHONE ?? '+216 70 000 000';
  const hours =
    import.meta.env.VITE_CENTER_HOURS ?? 'Lundi–vendredi, 8 h 30–17 h 30';
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
            <dt><MapPin aria-hidden="true" size={16} /> Adresse</dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt><Mail aria-hidden="true" size={16} /> Email</dt>
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
            <dt><CalendarClock aria-hidden="true" size={16} /> Horaires</dt>
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
