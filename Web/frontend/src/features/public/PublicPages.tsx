import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import badgeCheckIcon from 'lucide-static/icons/badge-check.svg';
import bookOpenCheckIcon from 'lucide-static/icons/book-open-check.svg';
import brainCircuitIcon from 'lucide-static/icons/brain-circuit.svg';
import briefcaseBusinessIcon from 'lucide-static/icons/briefcase-business.svg';
import calendarClockIcon from 'lucide-static/icons/calendar-clock.svg';
import codeIcon from 'lucide-static/icons/code-2.svg';
import fileSpreadsheetIcon from 'lucide-static/icons/file-spreadsheet.svg';
import paletteIcon from 'lucide-static/icons/palette.svg';
import mousePointerClickIcon from 'lucide-static/icons/mouse-pointer-click.svg';
import userPlusIcon from 'lucide-static/icons/user-plus.svg';
import trendingUpIcon from 'lucide-static/icons/trending-up.svg';
import awardIcon from 'lucide-static/icons/award.svg';
import starIcon from 'lucide-static/icons/star.svg';
import arrowLeftIcon from 'lucide-static/icons/arrow-left.svg';
import arrowRightIcon from 'lucide-static/icons/arrow-right.svg';

import academyHero from '../../assets/academy-hero.webp';
import academyHeroCompact from '../../assets/academy-hero-compact.webp';
import academyHeroAvif from '../../assets/academy-hero.avif';
import academyHeroCompactAvif from '../../assets/academy-hero-compact.avif';
import academyStudy from '../../assets/academy-study.webp';
import { apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Icon } from '../../shared/components/Icon.js';
import { TrainingCard } from '../trainings/TrainingCard.js';
import type {
  PaginatedTrainings,
  TrainingCategory,
} from '../trainings/types.js';

const categoryVisuals = [
  {
    matches: ['bureau', 'office', 'productiv'],
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=85',
  },
  {
    matches: ['data', 'ia', 'intelligence', 'analytics'],
    image:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85',
  },
  {
    matches: ['design', 'créa', 'crea', 'ux', 'ui'],
    image:
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1800&q=85',
  },
  {
    matches: ['web', 'développement', 'developpement', 'code', 'programm'],
    image:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=85',
  },
  {
    matches: ['management', 'leadership', 'projet', 'communication'],
    image:
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1800&q=85',
  },
] as const;

function getCategoryImage(category: Pick<TrainingCategory, 'name'>, index: number) {
  const categoryName = category.name.toLocaleLowerCase();
  const visual = categoryVisuals.find(({ matches }) =>
    matches.some((match) => categoryName.includes(match)),
  );
  return visual?.image ?? [academyStudy, academyHeroCompact, academyHero][index % 3]!;
}

export function LandingPage() {
  const { user } = useAuth();
  const [preview, setPreview] = useState<PaginatedTrainings>();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const categorySliderRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const didDrag = useRef(false);
  useEffect(() => {
    const slider = categorySliderRef.current;
    if (!slider) return;
    const advance = () => {
      const maxScroll = slider.scrollWidth - slider.clientWidth;
      const nextScroll = slider.scrollLeft + slider.clientWidth + 16;
      slider.scrollTo({
        left: nextScroll >= maxScroll - 2 ? 0 : nextScroll,
        behavior: 'smooth',
      });
    };
    const interval = window.setInterval(advance, 5000);
    return () => window.clearInterval(interval);
  }, [categories.length]);
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
        </div>
        <figure className="hero-visual">
          <picture>
            <source
              type="image/avif"
              srcSet={`${academyHeroCompactAvif} 768w, ${academyHeroAvif} 1080w`}
              sizes="(max-width: 767px) calc(100vw - 40px), 600px"
            />
            <img
              src={academyHero}
              srcSet={`${academyHeroCompact} 768w, ${academyHero} 1080w`}
              sizes="(max-width: 767px) calc(100vw - 40px), 600px"
              alt="Apprenants accompagnés par un formateur dans une salle moderne"
              width={1200}
              height={600}
              fetchPriority="high"
            />
          </picture>
        </figure>
      </section>
      <div className="landing-introduction">
        <p>
          Découvrez des parcours professionnels accessibles en ligne ou en
          présentiel, suivez votre progression et valorisez vos acquis par un
          certificat.
        </p>
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
        <div className="hero-image-caption">
          <strong>Apprendre ensemble</strong>
          <span>Des parcours concrets, en ligne et en présentiel.</span>
        </div>
      </div>
      <section className="landing-section benefits-section">
        <div className="section-copy">
          <div>
            <span className="context-label">Une expérience complète</span>
            <h2>
              Tout ce qu’il faut pour transformer une inscription en
              compétences.
            </h2>
          </div>
        </div>
        <div className="benefits-layout">
          <img
            className="benefits-image"
            src={academyStudy}
            alt="Une apprenante prend des notes pendant sa formation en ligne"
            width={960}
            height={640}
            loading="lazy"
            decoding="async"
          />
          <div className="feature-grid">
            <article>
              <Icon
                src={bookOpenCheckIcon}
                size={32}
                className="feature-icon"
              />
              <h3>Parcours structurés</h3>
              <p>
                Modules, leçons et ressources organisés pour avancer sans perdre
                le fil.
              </p>
            </article>
            <article>
              <Icon
                src={calendarClockIcon}
                size={32}
                className="feature-icon"
              />
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
        </div>
      </section>
      <section className="landing-section category-showcase">
        <div className="section-heading">
          <div>
            <span className="context-label">Domaines</span>
            <h2>Explorez par catégorie</h2>
          </div>
          <Link className="tertiary-link" to="/catalogue">
            Parcourir le catalogue <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="category-slider-wrap">
          <button
            className="category-slider-control category-slider-control-prev"
            type="button"
            aria-label="Catégorie précédente"
            onClick={() =>
              categorySliderRef.current?.scrollBy({
                left: -(categorySliderRef.current.clientWidth + 16),
                behavior: 'smooth',
              })
            }
          >
            <Icon src={arrowLeftIcon} size={20} />
          </button>
          <div
            className="category-slider"
            aria-label="Catégories de formation"
            ref={categorySliderRef}
            tabIndex={0}
            onPointerDown={(event) => {
              const slider = categorySliderRef.current;
              if (!slider) return;
              dragStartX.current = event.clientX;
              dragStartScrollLeft.current = slider.scrollLeft;
              didDrag.current = false;
              slider.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const slider = categorySliderRef.current;
              if (!slider || !slider.hasPointerCapture(event.pointerId)) return;
              const distance = event.clientX - dragStartX.current;
              if (Math.abs(distance) > 4) didDrag.current = true;
              if (didDrag.current) slider.scrollLeft = dragStartScrollLeft.current - distance;
            }}
            onPointerUp={(event) => {
              const slider = categorySliderRef.current;
              if (slider?.hasPointerCapture(event.pointerId)) {
                slider.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              const slider = categorySliderRef.current;
              if (slider?.hasPointerCapture(event.pointerId)) {
                slider.releasePointerCapture(event.pointerId);
              }
            }}
            onClick={(event) => {
              if (didDrag.current) {
                event.preventDefault();
                didDrag.current = false;
              }
            }}
          >
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
            const categoryImage = getCategoryImage(category, index);
            return (
              <Link
                className={`category-panel category-panel-${index % 5}`}
                key={category.id}
                to="/catalogue"
              >
                <img src={categoryImage} alt="" loading="lazy" decoding="async" />
                <span className="category-panel-overlay" aria-hidden="true" />
                <span className="category-panel-content">
                  <Icon src={categoryIcon} size={25} />
                  <strong>{category.name}</strong>
                  <small>
                    {'description' in category && category.description
                      ? category.description
                      : 'Des parcours pratiques pour développer des compétences utiles.'}
                  </small>
                  <span>Découvrir les parcours</span>
                </span>
              </Link>
            );
          })}
          </div>
          <button
            className="category-slider-control category-slider-control-next"
            type="button"
            aria-label="Catégorie suivante"
            onClick={() =>
              categorySliderRef.current?.scrollBy({
                left: categorySliderRef.current.clientWidth + 16,
                behavior: 'smooth',
              })
            }
          >
            <Icon src={arrowRightIcon} size={20} />
          </button>
        </div>
      </section>
      <section className="landing-section landing-training-preview">
        <div className="section-heading">
          <div>
            <span className="context-label">À découvrir</span>
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
            <span className="eyebrow">Avis des utilisateurs</span>
            <h2>Une expérience pensée pour rester simple.</h2>
          </div>
        </div>
        <div className="testimonial-grid">
          {[
            [
              'Ahmed',
              'Apprenant',
              'Une expérience très simple pour trouver ma formation et reprendre mes leçons.',
              'Parcours en ligne',
            ],
            [
              'Meriem',
              'Apprenante',
              'Le planning et les étapes à valider sont immédiatement compréhensibles.',
              'Suivi hebdomadaire',
            ],
            [
              'Sami',
              'Formateur',
              'Je retrouve mes contenus, sessions et évaluations sans détour.',
              'Accompagnement de groupe',
            ],
          ].map(([name, role, quote, detail]) => (
            <figure key={name}>
              <div
                className="testimonial-rating"
                role="img"
                aria-label="5 étoiles"
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <Icon key={index} src={starIcon} size={16} />
                ))}
              </div>
              <blockquote>« {quote} »</blockquote>
              <figcaption>
                <span aria-hidden="true">{name.slice(0, 1)}</span>
                <span><strong>{name}</strong><small>{role} · {detail}</small></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="landing-section how-section">
        <div>
          <span className="context-label">Comment ça marche</span>
          <h2>Un parcours simple, du choix au certificat.</h2>
        </div>
        <ol className="process-stepper">
          {[
            [mousePointerClickIcon, 'Choisissez', 'Explorez les formations publiées.'],
            [userPlusIcon, 'Inscrivez-vous', 'Créez votre compte Apprenant.'],
            [trendingUpIcon, 'Progressez', 'Suivez les contenus ou votre planning.'],
            [awardIcon, 'Validez', 'Réussissez les étapes requises.'],
          ].map(([icon, title, description], index) => (
          <li key={title}>
            <span className="process-icon"><Icon src={icon!} size={22} /></span>
            <small>0{index + 1}</small>
            <div>
            <strong>{title}</strong>
            <span>{description}</span>
            </div>
          </li>
          ))}
        </ol>
      </section>
      <section className="landing-cta">
        <div>
          <span className="context-label">Prêt à commencer ?</span>
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
    <section className="static-page about-page">
      <span className="eyebrow">À propos</span>
      <h1>La formation professionnelle, rendue plus lisible.</h1>
      <p className="lead">
        La plateforme accompagne un centre de formation dans la diffusion de
        parcours en ligne et l’organisation de sessions en présentiel.
      </p>
      <img
        className="about-image"
        src={academyHero}
        width={1200}
        height={600}
        alt="Un groupe d’apprenants échange avec un formateur"
        loading="lazy"
      />
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
  const [openQuestion, setOpenQuestion] = useState<string | null>(
    questions[0][0],
  );
  return (
    <section className="static-page faq-page">
      <span className="eyebrow">Questions fréquentes</span>
      <h1>Les réponses avant de commencer.</h1>
      <div className="faq-list">
        {questions.map(([question, answer], index) => (
          <article
            className={
              openQuestion === question ? 'faq-item is-open' : 'faq-item'
            }
            key={question}
          >
            <button
              type="button"
              aria-expanded={openQuestion === question}
              aria-controls={`faq-answer-${index}`}
              id={`faq-question-${index}`}
              onClick={() =>
                setOpenQuestion((current) =>
                  current === question ? null : question,
                )
              }
            >
              {question}
            </button>
            <div
              className="faq-answer"
              id={`faq-answer-${index}`}
              aria-labelledby={`faq-question-${index}`}
              hidden={openQuestion !== question}
            >
              <p>{answer}</p>
            </div>
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
