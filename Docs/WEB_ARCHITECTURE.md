# Architecture technique — projet Web

> Périmètre : `Web/frontend`, `Web/backend` et infrastructure racine directement utilisée par le projet Web. Le rapport de projet et le `README.md` ont servi à comprendre la terminologie ; en cas d'écart, le code est la référence.

## Objectif et rôle

Le projet Web est la plateforme principale de **High Skills Academy**. Il réunit :

- une SPA publique et des espaces métier pour les rôles `ADMIN`, `TRAINER` et `LEARNER` ;
- une API REST commune au Web et au Mobile ;
- la gestion du catalogue, des contenus, sessions, paiements, inscriptions, progressions, présences, évaluations, certificats, factures, feedbacks, coûts et tableaux de bord ;
- trois fonctions Gemini distinctes : tuteur pédagogique, concierge public et génération de questions ;
- Firebase Analytics facultatif côté navigateur et Firebase Cloud Messaging côté API pour le client mobile.

## Architecture globale et choix architecturaux

```text
Navigateur — React/Vite
  ├─ pages publiques et espaces par rôle
  ├─ access token JWT en mémoire
  └─ cookie de refresh HTTP-only
             │ JSON / multipart / téléchargements protégés
             ▼
API Express 5 — monolithe modulaire
  ├─ routes + DTO Zod + middlewares
  ├─ services métier
  ├─ modèles Mongoose / transactions
  └─ adaptateurs : Stripe, Gemini, SMTP, Firebase Admin, PDF, fichiers
             │
             ├─ MongoDB 8 (`rs0`)
             └─ volume local d'uploads/documents
```

Le backend est un **monolithe modulaire** : un seul processus Express et une seule base, mais 20 domaines séparés sous `src/modules`. Les routes adaptent HTTP, les services portent les règles métier, les modèles assurent la persistance et `infrastructure` isole les fournisseurs externes. Les dépendances sont assemblées explicitement dans `Web/backend/src/app.ts`, ce qui permet d'injecter des passerelles de test.

Choix vérifiables importants :

- API stateless pour les JWT d'accès, mais sessions de rafraîchissement persistées et rotatives ;
- transactions MongoDB pour les opérations atomiques sensibles ; le replica set est donc obligatoire ;
- fichiers hors de MongoDB, avec métadonnées et empreinte SHA-256 en base ;
- UI organisée par fonctionnalité, sans gestionnaire d'état global externe : Context React pour la session et état local pour les écrans ;
- contrats partagés conceptuellement, mais types TypeScript dupliqués entre frontend et backend ; aucune génération de client depuis OpenAPI.

## Structure du projet

```text
Web/
├── backend/
│   ├── src/server.ts                 # chargement env, MongoDB, index, serveur, arrêt propre
│   ├── src/app.ts                    # composition des services et montage des routes
│   ├── src/config/                   # validation de l'environnement, logger Pino
│   ├── src/middleware/               # authentification/RBAC, mot de passe, rate limiting
│   ├── src/modules/<domaine>/        # domain, dto, model, repository, service, route
│   ├── src/infrastructure/           # DB, HTTP, Stripe, fichiers, PDF, mail, OpenAPI
│   ├── src/shared/                   # erreurs, principal, mot de passe, dates Tunis
│   ├── src/scripts/                  # seeds administrateur et données de développement
│   ├── tests/                        # fondations et intégrations HTTP/MongoDB
│   ├── docker/init-replica-set.js    # initialisation idempotente de `rs0`
│   └── Dockerfile                    # build TypeScript puis image Node de production
└── frontend/
    ├── index.html / src/main.tsx     # entrée Vite/React
    ├── src/app/                      # routes, layouts et gardes de navigation
    ├── src/core/                     # API, authentification, Analytics
    ├── src/features/                 # pages regroupées par domaine
    ├── src/shared/                   # composants, styles globaux
    ├── src/assets/ et public/        # identité visuelle
    └── vite.config.ts                # React, alias/déduplication et Vitest/jsdom
```

À la racine, `package.json` définit les workspaces et commandes communes, `docker-compose.yml` fournit MongoDB, l'initialiseur, Mailpit et le backend, et `.github/workflows/ci.yml` exécute les contrôles et tests d'intégration.

## Technologies et outils

| Couche             | Technologies réellement utilisées                                                       |
| ------------------ | --------------------------------------------------------------------------------------- |
| Frontend           | React 19, React DOM, React Router 8, React Hook Form, Zod, Lucide, TypeScript 6, Vite 8 |
| Backend            | Node.js 24, Express 5, TypeScript ESM/NodeNext, Zod, Mongoose 9                         |
| Données            | MongoDB 8, replica set mono-nœud local `rs0`                                            |
| Authentification   | JWT HS256 avec `jose`, jetons opaques SHA-256, mots de passe `scrypt`                   |
| Externes           | Stripe Checkout, Google Gen AI/Gemini, Nodemailer/SMTP, Firebase Admin/FCM              |
| Documents/fichiers | Multer mémoire, `file-type`, `pdf-parse`, `fflate`, PDFKit                              |
| Observabilité/API  | Pino, `pino-http`, OpenAPI 3.0.3, Swagger UI                                            |
| Qualité            | Vitest, Testing Library, Supertest, Oxlint, Prettier, GitHub Actions                    |

## Backend : modules et éléments importants

Tous les chemins ci-dessous sont relatifs à `Web/backend/src/modules`.

| Domaine                     | Éléments centraux et rôle                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                      | `AuthService` : inscription Apprenant, connexion, rotation/révocation, reset et changement de mot de passe ; `TokenService` : JWT et jetons opaques ; modèles `RefreshSession`, `PasswordResetToken` |
| `users`                     | `UserService`, `UserModel`, rôle `ADMIN/TRAINER/LEARNER`, création/désactivation des Formateurs et profil ; seed du premier Administrateur                                                           |
| `trainings`                 | `TrainingService`, modèles `Training`/`TrainingCategory`, ownership, cycle `DRAFT → PUBLISHED → ARCHIVED`, miniature et transfert de propriétaire                                                    |
| `content`                   | `ContentService`, hiérarchie `TrainingModule → Lesson → TrainingResource`, ressources `FILE`/`EXTERNAL_URL`, visibilité et téléchargement autorisé                                                   |
| `sessions`                  | `SessionService`, `TrainingSession`, `SessionSchedule`, affectation de formateurs, capacité, planning, conflits et cycle `PLANNED/IN_PROGRESS/COMPLETED/CANCELLED`                                   |
| `payments`                  | `PaymentService`, `PaymentModel`, création Checkout, validation du webhook et fulfillment transactionnel                                                                                             |
| `enrollments`               | `EnrollmentAccessService` centralise l'accès payé ; `EnrollmentService` expose les inscriptions et leur éligibilité                                                                                  |
| `progress` / `attendance`   | progression par leçon pour le distanciel ; feuilles de présence par créneau pour le présentiel                                                                                                       |
| `completion`                | `CompletionService` calcule l'achèvement selon la modalité ; `EligibilityService` ajoute l'éventuelle évaluation certifiante                                                                         |
| `evaluations`               | `EvaluationService`, quatre modèles (évaluation, question, tentative, réponse), correction côté serveur, publication/archivage et résultats                                                          |
| `certificates` / `invoices` | snapshots métier, génération PDF à la demande et téléchargement protégé ; un certificat par inscription et une facture par paiement                                                                  |
| `feedback`                  | note immuable de 1 à 5 après éligibilité et agrégats de satisfaction                                                                                                                                 |
| `costs` / `dashboard`       | coûts formateurs et formations ; agrégats administrateur sur périodes `Africa/Tunis` ; recommandations déterministes par historique de catégorie et popularité                                       |
| `tutor`                     | sélection de leçons et réponse Gemini fondée avec citations vérifiées                                                                                                                                |
| `public-concierge`          | contexte limité aux pages publiques et formations publiées, réponses/liens contrôlés                                                                                                                 |
| `notifications`             | enregistrement des appareils Android et envoi FCM réservé à l'Administrateur                                                                                                                         |
| `contact`                   | validation et envoi d'un message via SMTP                                                                                                                                                            |

Les adaptateurs importants se trouvent dans `src/infrastructure` : `StripeSdkCheckoutGateway`, `LocalFileStorage`, `ProtectedDocumentStorage`, générateurs PDF, services SMTP, connexion/index MongoDB, middleware d'erreurs et document OpenAPI.

## Frontend : pages, composants et hooks

| Emplacement                             | Responsabilité                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/app/App.tsx`                       | définition complète des routes publiques, d'authentification et des espaces par rôle                                    |
| `src/app/layouts/*`                     | `PublicLayout`, `AuthLayout`, `RoleLayout` et navigation adaptée au rôle                                                |
| `src/app/routes/guards.tsx`             | `PublicOnly`, `RequireAuthentication`, `RequireRole` ; gardes UX, non frontière de sécurité                             |
| `src/core/auth/*`                       | `AuthProvider`, `AuthContext`, hook `useAuth`, refresh unique partagé et nouvelle tentative après 401                   |
| `src/core/api/client.ts`                | `apiRequest`, `apiDownload`, `ApiError`, ajout Bearer/cookie et localisation des erreurs                                |
| `src/core/analytics/*`                  | consentement, vues de page et mesure du tunnel de recommandation                                                        |
| `src/features/trainings`                | catalogue/fiches, achat, catégories et gestion des formations                                                           |
| `src/features/content`                  | consultation/édition du contenu, téléchargements, progression et `TutorChat`                                            |
| `src/features/sessions`, `attendance`   | sessions/planning et saisie/consultation des présences                                                                  |
| `src/features/evaluations`              | création, questions manuelles/IA, tentatives, correction et résultats                                                   |
| `src/features/payments`, `certificates` | statut de paiement, factures, certificats et feedback                                                                   |
| `src/features/dashboard`                | tableaux de bord par rôle et indicateurs administrateur                                                                 |
| `src/features/public`                   | accueil, à propos, FAQ, contact et `PublicConcierge`; celui-ci reste monté sur les pages publiques même après connexion |
| `src/shared/components`                 | avatar, menu utilisateur, pagination, sélection, icônes, titre et gestion du défilement                                 |

Les pages utilisent principalement `useState`, `useEffect`, `useCallback` et `useMemo`. Il n'existe pas de couche de cache serveur côté client ni de store Redux ; un changement de page relance généralement ses requêtes.

## Flux de données et communication

1. Un composant public appelle directement `apiRequest`; un composant authentifié passe par `useAuth().request`.
2. `AuthProvider` joint le JWT d'accès conservé en mémoire. Le navigateur envoie aussi le cookie de refresh grâce à `credentials: 'include'`.
3. Après un `401`, une seule promesse de refresh est partagée, le JWT est remplacé et la requête est rejouée ; un échec remet le client en mode invité.
4. L'API valide paramètres/corps avec Zod, construit le principal depuis le JWT **et recharge le compte actif en base**, puis le service vérifie rôle, ownership, affectation ou inscription.
5. Les services lisent/écrivent MongoDB et appellent, si nécessaire, un adaptateur externe. Les erreurs suivent `{ error: { code, message, fieldErrors? }, requestId }`.

### Surface API principale

| Groupe             | Endpoints représentatifs                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Public             | `GET /health`, `/categories`, `/trainings`, `/trainings/:id`, `/sessions`; `POST /contact`, `/public/concierge/messages` |
| Identité           | `/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`, `/me`      |
| Offre/contenu      | `/trainings/*`, `/modules/*`, `/lessons/*`, `/resources/*`, `/sessions/*`, `/schedules/*`                                |
| Apprentissage      | `/progress`, `/attendance`, `/evaluations`, `/attempts`, `/trainings/:id/tutor/messages`                                 |
| Commerce/documents | `/payments/checkout`, `/payments`, `/enrollments`, `/invoices`, `/certificates`, `/feedback`                             |
| Pilotage           | `/costs/*`, `/dashboard/*`, `/notifications/*`                                                                           |

Le contrat complet est codé dans `Web/backend/src/infrastructure/openapi/document.ts` et servi sur `/api/openapi.json` et `/api/docs`.

## Authentification, autorisation et sécurité

- Le JWT d'accès HS256 contient `sub`, `role`, `typ=access`, issuer et audience ; durée configurable, valeur par défaut 15 minutes.
- Le refresh Web est un cookie `httpOnly`, `sameSite=lax`, limité au chemin `/api/auth`, `secure` en production. Sa valeur hachée est persistée ; chaque refresh révoque et remplace la session. Une réutilisation révoque toutes les sessions actives de l'utilisateur.
- Les mots de passe sont dérivés avec `scrypt` (`N=16384`, `r=8`, `p=1`, sel aléatoire de 32 octets) et comparés en temps constant.
- Les comptes Formateur utilisent un mot de passe temporaire et restent limités par `requirePasswordChanged` jusqu'à son remplacement.
- L'autorisation serveur combine RBAC, propriété de formation, affectation à une session et présence d'une `Enrollment`. Les gardes React ne font qu'éviter une navigation incohérente.
- Entrées Zod strictes, CORS sur liste d'origines, en-têtes `nosniff`, `DENY`, politique de référent et HSTS en production ; `x-powered-by` est désactivé.
- Pino masque Authorization, cookies, signature Stripe, mots de passe, jetons et secrets ; chaque requête reçoit un identifiant.
- Le limiteur IP est **en mémoire et par processus** : contact 5, inscription/connexion 10, refresh 30, reset 10, Checkout 20, concierge 10 et tuteur 30 par fenêtre de 15 minutes. La génération IA de questions n'emploie pas ce middleware.
- Les fichiers sont filtrés par extension, MIME et signature, limités en taille, nommés aléatoirement et résolus sous la racine configurée pour bloquer la traversée de chemin. Ils ne sont servis que via des routes autorisées.
- Stripe reçoit les données de carte sur sa page hébergée ; l'application ne les stocke pas.

## Base de données et modèles

MongoDB contient les collections suivantes, initialisées par `initializeDatabaseIndexes()` au démarrage ; il n'existe pas de système de migrations séparé.

| Groupe            | Collections                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Identité          | `users`, `refresh_sessions`, `password_reset_tokens`                                                  |
| Catalogue/contenu | `training_categories`, `trainings`, `training_modules`, `lessons`, `training_resources`               |
| Présentiel        | `training_sessions`, `session_schedules`, `attendances`                                               |
| Commerce          | `payments`, `enrollments`, `invoices`, `invoice_items`                                                |
| Pédagogie         | `lesson_progress`, `evaluations`, `evaluation_questions`, `evaluation_attempts`, `evaluation_answers` |
| Sorties/pilotage  | `certificates`, `feedback`, `trainer_costs`, `training_costs`, `notification_devices`                 |

Relations structurantes : `Training` référence sa catégorie et son Formateur propriétaire ; le contenu et les sessions référencent la formation ; `Enrollment` relie Apprenant, formation/session et paiement ; progression, présence et tentative sont rattachées à l'inscription ; facture et certificat stockent des snapshots pour préserver l'historique.

Les index uniques protègent notamment l'e-mail et l'unique Administrateur, l'ordre des contenus, une inscription distancielle par apprenant/formation, une inscription présentielle par apprenant/session, une présence par inscription/créneau, une facture par paiement et un certificat par inscription.

## Configuration et variables d'environnement

| Emplacement             | Variables principales                                                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Racine `.env` / Compose | `MOBILE_APP_SCHEME`, `STRIPE_*`, `AI_*`                                                                                                                                                                                                                                      |
| `Web/backend/.env`      | `NODE_ENV`, `PORT`, `MONGODB_URI`, `WEB_APP_URL`, `MOBILE_APP_SCHEME`, `CORS_ORIGINS`, `TZ=UTC`, `LOG_LEVEL`, `JWT_*`, TTL, `INITIAL_ADMIN_*`, `SMTP_*`, `STRIPE_*`, `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB`, `AI_*`, `FCM_ENABLED`, `GOOGLE_APPLICATION_CREDENTIALS`, `CENTER_*` |
| `Web/frontend/.env`     | `VITE_API_BASE_URL`, informations publiques `VITE_CENTER_*`, interrupteurs/configuration `VITE_FIREBASE_*`                                                                                                                                                                   |

`loadAppConfig()` valide et normalise l'environnement avec Zod avant le démarrage. Toutes les variables `VITE_*` sont publiques dans le bundle et ne doivent contenir aucun secret.

## Principaux flux fonctionnels

### Achat et attribution d'accès

```text
Apprenant → POST /payments/checkout
API → Payment(PENDING) + session Stripe hébergée
Navigateur → Stripe → redirection de retour
Stripe → webhook signé sur corps brut
API → contrôle IDs/montant/devise/statut
API → transaction : capacité + Enrollment + Invoice + InvoiceItem + Payment(PAID)
Client → interroge /payments/:id ; la redirection seule ne donne aucun accès
```

Le traitement est idempotent si le paiement est déjà `PAID`. Les index et la transaction empêchent les doubles inscriptions/documents ; une capacité épuisée au moment du webhook fait échouer le paiement interne. Aucun mécanisme de remboursement Stripe n'est visible dans ce flux : ce cas doit donc être traité opérationnellement ou complété avant une mise en production.

### Apprentissage et certification

- Distanciel : `Enrollment` → contenu autorisé → `LessonProgress` → 100 % des leçons actives.
- Présentiel : session achevée + présence enregistrée sur tous les créneaux + seuil de la formation (80 % par défaut).
- Si une évaluation certifiante est désignée, une tentative `PASSED` est également requise.
- `CertificateService.generate` recalcule l'éligibilité, vérifie l'identité de l'Apprenant, crée un snapshot idempotent, puis génère le PDF protégé.
- Le feedback 1–5 n'est accepté qu'après éligibilité et une seule fois par inscription.

### IA

| Fonction  | Public/source                                                                                                  | Garde-fous concrets                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tuteur    | Apprenant inscrit ; au plus 5 leçons actives pertinentes                                                       | contexte ≤ min(`AI_MAX_CONTEXT_CHARS`, 24 000), 8 messages, schéma Zod, citations limitées aux IDs fournis, pas de stockage du chat, rate limit       |
| Concierge | Anonyme ; pages publiques + champs sélectionnés de 100 formations `PUBLISHED` max.                             | 8 sources/12 000 caractères, 4 messages, liens résolus côté serveur, prompt anti-injection, honeypot, rate limit, aucune collection privée interrogée |
| Questions | Formateur propriétaire d'une évaluation `DRAFT` ; contenu de sa formation et fichiers PDF/DOCX/PPTX/TXT locaux | contexte borné, JSON structuré et revalidé, nombre/type exacts, import en brouillon ; publication et désignation restent manuelles                    |

### Firebase Analytics Web

Firebase n'est initialisé que si l'option est activée, la configuration minimale existe, le navigateur est compatible et le consentement `granted` est stocké dans `localStorage`. Les mesures sont :

- `page_view` : URL, chemin et titre ;
- `recommendation_impression`, `recommendation_click`, `recommendation_enrollment` : ID de formation, catégorie et rang.

L'attribution d'une recommandation reste dans `sessionStorage` jusqu'à sept jours et la conversion n'est émise qu'après confirmation d'une inscription par le backend. Les fonctions d'événement n'ajoutent ni nom, ni e-mail, ni montant de paiement. Firebase Auth, Firestore, Storage et Hosting ne sont pas utilisés.

## Points d'entrée, développement, build et déploiement

- Frontend : `src/main.tsx` monte `BrowserRouter → AuthProvider → App`. Développement : `npm run dev:frontend`. Build : `tsc -b && vite build`; résultat statique dans `Web/frontend/dist`.
- Backend : `src/server.ts` charge d'abord `.env` racine puis `Web/backend/.env`, connecte MongoDB, initialise les index et écoute le port. Développement : `npm run dev:backend`; build/start : `tsc` puis `node dist/server.js`.
- Local : `npm run docker:up` construit uniquement le backend et démarre MongoDB `rs0`, son initialiseur et Mailpit. Le frontend n'a pas de service Docker.
- CI : format, lint, typecheck, tests, builds Web/backend, validation Compose, health check et tests d'intégration. Il n'existe pas de manifeste de déploiement production ni de configuration d'hébergement du frontend.
- Paiement : le schéma d'environnement exige actuellement une clé `STRIPE_SECRET_KEY` commençant par `sk_test_`; le passage au mode live nécessite donc une évolution de configuration et une validation métier, pas un simple changement de secret.

## Patterns, conventions et dépendances

- **Feature/module folders** des deux côtés ; `domain → dto/model → service → route` côté API.
- **Dependency injection manuelle** dans `createApp`, avec interfaces de gateway pour Stripe et Gemini.
- **DTO stricts et erreurs applicatives codées** (`AppError`/`ApiError`).
- **Soft archive** pour les entités ayant un historique ; suppression refusée quand la progression ou l'historique métier existe.
- **Transactions et index uniques** comme deuxième ligne de défense contre la concurrence.
- **Snapshots financiers et de certification** pour ne pas réécrire l'historique après modification d'un profil ou d'une formation.
- `PaymentService` dépend de Users, Trainings, Sessions, Enrollments et Invoices ; `EligibilityService` dépend de Completion et Evaluations ; `DashboardService` agrège presque tous les domaines ; Content et Tutor dépendent d'Enrollment pour l'accès.

## Pour comprendre rapidement le projet

1. Lire `Web/backend/src/app.ts` puis `src/modules/<domaine>/routes` pour la surface HTTP.
2. Suivre une route vers son DTO, son service et ses modèles ; les règles décisives sont dans les services, pas dans les composants React.
3. Lire `Web/frontend/src/app/App.tsx`, `core/auth/AuthProvider.tsx` et `core/api/client.ts` avant une page de `features`.
4. Utiliser `/api/docs` pour explorer le contrat, puis les tests d'intégration pour les cas limites.
5. Commencer par les flux `Payment → Enrollment`, `Enrollment → Completion/Eligibility` et `Training → Content/Session` : ils structurent la majorité des dépendances.

## Questions de discussion pour la soutenance

### 1. Pourquoi choisir un monolithe modulaire plutôt que des microservices pour ce périmètre ?

Le code comporte une seule API Express, une seule connexion MongoDB et des domaines fortement transactionnels. Le fulfillment Stripe crée inscription, facture et ligne de facture, met à jour la capacité et marque le paiement dans une même transaction. Des microservices imposeraient contrats réseau, observabilité distribuée et cohérence éventuelle sans besoin vérifié d'échelle indépendante. Les modules et gateways conservent néanmoins des frontières permettant une extraction ultérieure.

### 2. Pourquoi l'autorisation est-elle vérifiée dans l'API et pas seulement dans les routes du client ?

Les routes React sont contournables par appel HTTP direct. L'API recharge le compte, vérifie son activation, le rôle, le changement de mot de passe, l'ownership, l'affectation et l'inscription. Par exemple, `ContentService` n'accorde `LEARNER_READ` qu'après recherche d'une `Enrollment`, et `PaymentService` filtre les paiements d'un Apprenant par son propre identifiant. Les gardes client améliorent seulement l'UX.

### 3. Pourquoi l'accès est-il créé après le webhook Stripe plutôt qu'après la redirection utilisateur ?

La redirection peut être copiée, abandonnée ou déclenchée sans paiement confirmé. Le webhook est vérifié avec la signature Stripe sur le corps brut, puis l'API compare session, paiement, utilisateur, formation, session présentielle, montant et devise au snapshot `Payment`. Ce n'est qu'ensuite que la transaction crée `Enrollment` et `Invoice`. La page de retour se contente d'interroger `/payments/:id`.

### 4. Comment le système limite-t-il le risque d'hallucination ou de fuite de données dans les assistants IA ?

Les appels Gemini partent du backend et reçoivent des contextes explicitement construits. Le tuteur ne reçoit que des leçons d'une formation payée et ses citations sont comparées aux IDs autorisés. Le concierge ne lit que des constantes publiques et des champs de formations publiées ; ses citations et actions sont résolues côté serveur. Les sorties JSON sont validées par Zod, les tailles sont bornées et les prompts traitent entrées/sources comme non fiables. Cela réduit le risque sans constituer une preuve formelle d'absence d'hallucination.

### 5. Quelle différence existe-t-il entre le tuteur IA, le concierge public et la génération de questions ?

Le tuteur répond à un Apprenant inscrit à partir d'au plus cinq leçons et fournit des citations pédagogiques. Le concierge est anonyme et oriente uniquement à partir d'informations publiques. La génération de questions est un outil de rédaction pour le Formateur propriétaire : elle exploite le contenu et certains fichiers de la formation, puis sauvegarde des questions dans une évaluation brouillon ; elle ne publie rien automatiquement.

### 6. Comment le consentement Firebase est-il respecté et quelles données sont réellement mesurées ?

Sur le Web, Analytics reste non initialisé tant que l'option, la configuration, la compatibilité et le consentement explicite ne sont pas réunis. Le choix est dans `localStorage`. Le code émet seulement les vues de page et trois événements de recommandation avec ID, catégorie et rang ; aucune fonction de suivi n'ajoute identité ou paiement. L'attribution locale est supprimée après conversion. Le dépôt ne peut toutefois pas contrôler les traitements ultérieurs configurés dans la console Firebase.

### 7. Quelles limites apparaissent si l'application doit être déployée sur plusieurs instances ?

Le limiteur IP est une `Map` locale : ses compteurs divergent et disparaissent au redémarrage. Les uploads/PDF utilisent un disque local, donc une autre instance peut ne pas trouver le fichier. Le replica set Compose n'a qu'un nœud et n'offre pas de haute disponibilité. Il faudrait un rate limiter partagé, un stockage objet commun, un MongoDB répliqué de production, un équilibrage cohérent et une stratégie d'observabilité/secrets. Les transactions et index MongoDB rendent en revanche le fulfillment concurrent plus robuste si toutes les instances partagent la même base.

### 8. Quelles améliorations prioriser après une évaluation auprès d'utilisateurs réels ?

Prioriser d'abord les blocages observés sur les parcours critiques : découverte/achat, retour Stripe, suivi de progression, saisie de présence, création d'évaluation et compréhension des réponses IA. Le code ne mesure actuellement que pages et recommandations ; il faudrait ajouter, après consentement, des événements minimisés pour les abandons et erreurs de ces parcours, corriger accessibilité et libellés selon les tests, puis traiter les limites d'exploitation déjà visibles : stockage partagé, rate limiting distribué, secrets/monitoring et déploiement frontend de production.
