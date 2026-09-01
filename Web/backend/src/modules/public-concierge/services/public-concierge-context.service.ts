import { TrainingCategoryModel } from '../../trainings/models/training-category.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import type { PublicConciergeMessageInput } from '../dto/public-concierge.dto.js';

export interface PublicConciergeSource {
  id: string;
  title: string;
  href: string;
  text: string;
  kind: 'PAGE' | 'TRAINING';
}

export interface PublicConciergeContext {
  sources: PublicConciergeSource[];
  contextChars: number;
}

export interface PublicConciergeContextRetriever {
  retrieve(input: PublicConciergeMessageInput): Promise<PublicConciergeContext>;
}

const publicPageSources: readonly PublicConciergeSource[] = [
  {
    id: 'page:overview',
    title: 'High Skills Academy',
    href: '/',
    kind: 'PAGE',
    text: 'High Skills Academy propose des formations professionnelles en ligne et en présentiel. Le catalogue public permet de comparer les parcours avant de créer un compte.',
  },
  {
    id: 'page:catalogue',
    title: 'Catalogue des formations',
    href: '/catalogue',
    kind: 'PAGE',
    text: 'Le catalogue public présente uniquement les formations publiées, avec leur description, niveau, durée, modalité, prérequis et prix. Chaque fiche donne les informations disponibles avant inscription.',
  },
  {
    id: 'page:registration',
    title: 'Créer un compte apprenant',
    href: '/register',
    kind: 'PAGE',
    text: 'Un visiteur peut créer lui-même un compte Apprenant depuis la page d’inscription. Les comptes Formateur sont créés exclusivement par un administrateur du centre.',
  },
  {
    id: 'page:enrollment',
    title: 'Inscription et paiement',
    href: '/faq',
    kind: 'PAGE',
    text: 'Pour s’inscrire, le visiteur consulte une fiche de formation, crée un compte ou se connecte, puis suit le parcours d’inscription et de paiement affiché. La confirmation de paiement vient du prestataire de paiement et du backend sécurisé. Le concierge ne demande jamais de mot de passe ni de données bancaires.',
  },
  {
    id: 'page:learning',
    title: 'Déroulement des formations',
    href: '/faq',
    kind: 'PAGE',
    text: 'Une formation en ligne se suit à son rythme avec des modules et des leçons. Pour une formation en présentiel, l’apprenant choisit une session avec des dates et un lieu. Les certificats dépendent des conditions de progression, présence et évaluation applicables.',
  },
  {
    id: 'page:about',
    title: 'À propos',
    href: '/about',
    kind: 'PAGE',
    text: 'La page À propos présente la mission et le fonctionnement général de High Skills Academy.',
  },
  {
    id: 'page:contact',
    title: 'Contacter High Skills Academy',
    href: '/contact',
    kind: 'PAGE',
    text: 'Pour une question non couverte par les informations publiques, le visiteur peut utiliser la page Contact. Il ne faut jamais transmettre de mot de passe ou de données de carte dans un message.',
  },
];

const ignoredTerms = new Set([
  'avec',
  'dans',
  'des',
  'est',
  'les',
  'pour',
  'que',
  'qui',
  'une',
  'vous',
  'votre',
  'comment',
  'the',
  'and',
  'for',
]);

function terms(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((term) => !ignoredTerms.has(term)) ?? [],
    ),
  ];
}

function relevance(source: PublicConciergeSource, queryTerms: string[]): number {
  const sourceTerms = new Set(terms(`${source.title} ${source.text}`));
  return queryTerms.reduce(
    (score, term) => score + (sourceTerms.has(term) ? 1 : 0),
    0,
  );
}

export class PublicConciergeContextService
  implements PublicConciergeContextRetriever
{
  readonly #maximumChars: number;

  constructor(maximumChars = 12_000) {
    this.#maximumChars = maximumChars;
  }

  async retrieve(
    input: PublicConciergeMessageInput,
  ): Promise<PublicConciergeContext> {
    const queryTerms = terms(
      `${input.message} ${input.conversation
        .filter(({ role }) => role === 'USER')
        .map(({ content }) => content)
        .join(' ')}`,
    );
    const trainings = await TrainingModel.find({ status: 'PUBLISHED' })
      .select({
        title: 1,
        description: 1,
        categoryId: 1,
        level: 1,
        durationMinutes: 1,
        objectives: 1,
        prerequisites: 1,
        type: 1,
        priceMinor: 1,
        currency: 1,
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean()
      .exec();
    const categories = await TrainingCategoryModel.find({
      _id: { $in: trainings.map(({ categoryId }) => categoryId) },
      isArchived: false,
    })
      .select({ name: 1 })
      .lean()
      .exec();
    const categoryNames = new Map(
      categories.map((category) => [String(category._id), category.name]),
    );
    const trainingSources = trainings
      .filter((training) => categoryNames.has(String(training.categoryId)))
      .map(
        (training): PublicConciergeSource => ({
          id: `training:${String(training._id)}`,
          title: training.title,
          href: `/trainings/${String(training._id)}`,
          kind: 'TRAINING',
          text: [
            training.description,
            `Catégorie: ${categoryNames.get(String(training.categoryId))}`,
            `Niveau: ${training.level}`,
            `Modalité: ${training.type === 'SELF_PACED_ONLINE' ? 'en ligne à son rythme' : 'en présentiel'}`,
            `Durée: ${training.durationMinutes} minutes`,
            `Prix public: ${(training.priceMinor / 100).toFixed(2)} ${training.currency}`,
            training.objectives.length === 0
              ? ''
              : `Objectifs: ${training.objectives.join('; ')}`,
            training.prerequisites.length === 0
              ? 'Prérequis: aucun prérequis indiqué'
              : `Prérequis: ${training.prerequisites.join('; ')}`,
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      );

    const rankedPages = [...publicPageSources]
      .map((source, index) => ({
        source,
        score:
          relevance(source, queryTerms) +
          (source.href === input.currentPath ? 4 : 0) +
          (index === 0 ? 0.1 : 0),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    const rankedTrainings = trainingSources
      .map((source) => ({ source, score: relevance(source, queryTerms) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    const ranked = [...rankedPages, ...rankedTrainings]
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
    const contactSource = publicPageSources.find(
      ({ id }) => id === 'page:contact',
    )!;
    if (!ranked.some(({ source }) => source.id === contactSource.id)) {
      if (ranked.length === 8) ranked.pop();
      ranked.push({ source: contactSource, score: -1 });
    }

    const sources: PublicConciergeSource[] = [];
    let contextChars = 0;
    for (const { source } of ranked) {
      const prefix = `[PUBLIC SOURCE ${source.id}]\nTitle: ${source.title}\n`;
      const remaining = this.#maximumChars - contextChars - prefix.length;
      if (remaining <= 0) break;
      const text = source.text.slice(0, remaining);
      sources.push({ ...source, text });
      contextChars += prefix.length + text.length;
    }
    return { sources, contextChars };
  }
}
