# Architecture technique — projet Mobile

> Périmètre : `Mobile/`. Le client mobile est analysé comme un projet autonome, mais il consomme l'API de `Web/backend`. Il ne possède ni backend ni base métier propres. Le rapport et `Mobile/AUDIT.md` ont été consultés uniquement comme contexte ; le code courant est la référence.

## Objectif et rôle

Le projet Mobile est le client natif Expo/React Native de **High Skills Academy**. Il transpose sur téléphone les parcours public, Apprenant, Formateur et Administrateur : catalogue, authentification, achat Stripe, contenus, progression, sessions, présence, évaluations, certificats, gestion et tableaux de bord.

Ses adaptations natives vérifiables sont le stockage sécurisé du refresh token, les liens profonds, la sélection et le partage de fichiers, Firebase Analytics avec consentement et les notifications Android via FCM. Toute règle métier et toute donnée durable restent dans l'API Web.

## Architecture globale et choix architecturaux

```text
index.ts
  → App
    → SafeAreaProvider
      → AuthProvider
        → NavigationContainer + deep links
          → NotificationProvider
            → RootNavigator
              ├─ pile invité
              ├─ pile mot de passe obligatoire
              └─ pile authentifiée + drawer par rôle

Écrans/features → useAuth().request/download → API REST Web
Stockage local   → Expo SecureStore (refresh, consentements, attribution)
Services natifs  → Firebase Analytics/FCM, Expo Notifications, fichiers/partage
```

Le projet suit une organisation **par fonctionnalités**. `core` centralise les préoccupations transversales, `features` contient les écrans métier et `shared` fournit composants et tokens. La session et le drawer utilisent React Context ; les données d'écran utilisent l'état local et des requêtes REST directes. Il n'existe ni Redux, ni cache de requêtes, ni couche repository mobile.

`RootNavigator` choisit la pile selon `status`, `user` et `mustChangePassword`. La liste d'écrans authentifiés est commune à tous les rôles ; le drawer et plusieurs écrans filtrent l'interface, mais l'autorisation définitive est appliquée par l'API.

## Structure des dossiers et fichiers

```text
Mobile/
├── index.ts                         # enregistre le composant Expo racine
├── app.json                         # métadonnées, plugins, permissions et scheme
├── app.config.js                    # injecte conditionnellement les fichiers Firebase natifs
├── firebase.json                    # désactive collecte/écrans/auto-init par défaut
├── src/
│   ├── app/App.tsx                  # providers, navigation, Analytics, concierge
│   ├── app/navigation/              # stacks, types, linking, drawer, navigation FCM
│   ├── core/api/                    # client HTTP et erreurs
│   ├── core/auth/                   # Context, Provider, rotation de session
│   ├── core/storage/                # refresh token dans SecureStore
│   ├── core/analytics/              # consentement et événements Firebase
│   ├── core/notifications/          # permission, token FCM, listeners et préférences
│   ├── core/files/                  # téléchargement, sauvegarde Android et partage
│   ├── core/config/                 # validation de l'URL API et du scheme
│   ├── features/                    # écrans regroupés par domaine
│   └── shared/                      # composants, thème et formats date/pourcentage
├── tests/                           # Jest/Testing Library, API, auth, navigation et flux
└── android/                         # projet natif généré, Gradle, manifeste et ressources
```

Les répertoires `.expo`, `dist`, `node_modules` et `android` sont générés/ignorés par `Mobile/.gitignore`, même s'ils existent dans l'espace de travail courant. Aucun répertoire natif `ios/` n'est présent.

## Technologies, frameworks et outils

| Domaine       | Technologies réellement utilisées                                                     |
| ------------- | ------------------------------------------------------------------------------------- |
| UI/native     | Expo 57, React Native 0.86, React 19, Safe Area Context, Screens, SVG, Lucide         |
| Navigation    | React Navigation 7, Native Stack, navigation ref et linking personnalisé              |
| Auth/stockage | Fetch, React Context, Expo SecureStore                                                |
| Fichiers      | Expo File System, Document Picker, Image Picker, Sharing                              |
| Firebase      | React Native Firebase App, Analytics et Messaging ; Expo Notifications                |
| Android       | Gradle, Kotlin/React Native généré, Hermes, nouvelle architecture React Native        |
| Qualité       | TypeScript strict, Jest 29, Jest Expo, Testing Library React Native, Oxlint, Prettier |

## Modules, composants, hooks et utilitaires importants

### Noyau applicatif

| Emplacement                                     | Élément et responsabilité                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/App.tsx`                               | assemble session, navigation, notifications, concierge et consentement Analytics                 |
| `src/app/navigation/RootNavigator.tsx`          | déclare les piles invité/authentifiée/mot de passe et tous les écrans                            |
| `src/app/navigation/types.ts`                   | paramètres typés des routes                                                                      |
| `src/app/navigation/linking.ts`                 | associe le scheme aux routes publiques, reset et retour de paiement                              |
| `src/app/navigation/notification-navigation.ts` | liste blanche des destinations ouvertes depuis FCM ; ignore les autres                           |
| `src/core/api/client.ts`                        | `ApiClient`, `ApiError`, ajout du Bearer, parsing JSON et messages localisés                     |
| `src/core/auth/AuthProvider.tsx`                | bootstrap, login/register/logout, refresh single-flight, retry 401 et téléchargement authentifié |
| `src/core/auth/AuthContext.ts`                  | contrat et hook `useAuth()` utilisés par les écrans                                              |
| `src/core/auth/mobile-session.ts`               | échange le refresh token contre une nouvelle session et persiste le remplaçant                   |
| `src/core/storage/refresh-token-store.ts`       | adaptateur `secureRefreshTokenStore` sur Expo SecureStore                                        |
| `src/core/config/environment.ts`                | construit `appConfig` et valide URL HTTP(S), nom du centre et URI scheme                         |

### Fonctionnalités

| Dossier                 | Écrans/composants principaux                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `features/public`       | `HomeScreen`, `AboutScreen`, `FaqScreen`, `ContactScreen`, `PublicConcierge`                    |
| `features/auth`         | connexion, inscription Apprenant, oubli/reset et changement de mot de passe ; validation locale |
| `features/trainings`    | catalogue invité/authentifié, détail, Checkout, gestion/création, miniature et ownership        |
| `features/learning`     | `ContentScreen`, `ProgressScreen`, `ContentManagementPanel`, `TutorChat`                        |
| `features/sessions`     | liste/détail, vues publiques/enrolled/managed et gestion des plannings                          |
| `features/attendance`   | planning Apprenant et feuille de présence tactile du personnel                                  |
| `features/evaluations`  | tentatives Apprenant, création et édition Formateur, génération IA, résultats/archivage         |
| `features/payments`     | retour Checkout avec polling, historique, factures téléchargées                                 |
| `features/certificates` | éligibilité, génération idempotente, téléchargement, feedback et statistiques Admin             |
| `features/admin`        | utilisateurs, catégories, coûts et six agrégats de tableau de bord                              |
| `features/workspace`    | accueil par rôle, résumé, drawer, profil et paramètres                                          |

### Éléments natifs et partagés

- `NotificationProvider`, `NotificationPreferences` et `firebase-messaging.ts` gèrent permission Android, enregistrement/suppression du token, messages au premier plan, ouverture et rotation FCM.
- `core/analytics/firebase.ts` et `recommendation-analytics.ts` gèrent consentement, vues d'écran et attribution des recommandations.
- `core/files/download.ts` enregistre via Storage Access Framework sur Android ; ailleurs il ouvre le partage. `share.ts` encapsule Expo Sharing.
- `shared/components` fournit `Button`, `TextField`, `StatePanel`, `Notice`, `ProgressBar`, `Brand` et le bouton de retour en haut.
- `shared/theme/tokens.ts` centralise couleurs, espacements et rayons ; `shared/utils/format.ts` affiche dates en `Africa/Tunis` et pourcentages.

## Flux de données et interactions API

### Requête authentifiée

1. L'écran appelle `useAuth().request(path, options)`.
2. `AuthProvider` passe l'access token en mémoire à `ApiClient`, qui ajoute `Authorization: Bearer`.
3. Sur `401`, une promesse de refresh unique lit le jeton de SecureStore, appelle `POST /auth/refresh` avec `client: MOBILE`, stocke le refresh rotatif reçu, puis rejoue la requête.
4. Si le refresh échoue, jetons et utilisateur local sont effacés et la pile invité est affichée.

Les requêtes publiques (`catalogue`, sessions publiques, contact, concierge, oubli/reset) utilisent directement `apiClient`. Le client n'utilise pas les cookies du flux Web.

### Contrats consommés

| Fonction mobile         | Endpoints principaux                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Authentification/profil | `/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`, `/me` |
| Catalogue/gestion       | `/categories`, `/trainings`, `/trainings/:id`, miniature, owner et actions de cycle de vie                          |
| Contenu/progression/IA  | `/trainings/:id/content`, `/modules`, `/lessons`, `/resources`, `/progress`, `/trainings/:id/tutor/messages`        |
| Sessions/présence       | `/sessions`, `/session-trainers`, `/schedules`, `/attendance`                                                       |
| Achat                   | `/payments/checkout`, `/payments`, `/enrollments`, `/invoices`                                                      |
| Évaluations/certificats | `/evaluations`, `/questions`, `/attempts`, `/certificates`, `/feedback`                                             |
| Administration          | `/users`, `/learners`, `/trainers`, `/costs`, `/dashboard`                                                          |
| Public/notifications    | `/contact`, `/public/concierge/messages`, `/notifications/devices`                                                  |

Les interfaces de `features/*/types.ts` décrivent les réponses attendues, mais elles sont maintenues manuellement et ne sont pas générées depuis l'OpenAPI du backend.

## Authentification, autorisation et sécurité

- L'access token reste dans une `ref` en mémoire ; le refresh token opaque est stocké sous `plateforme-formations.refresh-token` dans Expo SecureStore.
- Le serveur renouvelle le refresh token à chaque utilisation. Le client sérialise les refresh concurrents et remplace immédiatement la valeur locale.
- La déconnexion tente d'abord de supprimer le token FCM côté API, révoque ensuite le refresh mobile, puis efface la session locale même si le réseau échoue.
- `RootNavigator` force l'écran de changement de mot de passe si `mustChangePassword=true`. Le drawer masque les actions non pertinentes et les écrans Admin/personnel font des contrôles d'affichage.
- Ces contrôles ne sont pas suffisants : l'ensemble des écrans est enregistré dans la pile authentifiée et un client modifié pourrait appeler toute URL. L'API contrôle donc rôle, compte actif, propriété, affectation et inscription.
- `ApiClient` ne journalise pas les jetons. Les téléchargements utilisent un Bearer puis un nom de fichier assaini dans le cache.
- Les secrets Stripe, Gemini et Firebase Admin ne figurent pas dans le code mobile. Les variables `EXPO_PUBLIC_*` et fichiers de configuration Firebase natifs ne sont pas des secrets de serveur.
- Le projet autorise actuellement `http://` dans `EXPO_PUBLIC_API_BASE_URL` pour le développement ; une distribution réelle doit utiliser HTTPS.

## Données et stockage local

Le Mobile n'a **aucune base de données métier locale**. Les formations, utilisateurs, paiements, progressions et autres entités proviennent de MongoDB via l'API et résident seulement dans l'état des écrans.

| Stockage          | Données réellement conservées                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| SecureStore       | refresh token, consentement Analytics, attribution de recommandation, choix de notification, indicateur de prompt déjà affiché, token FCM |
| Mémoire React     | access token, utilisateur courant, listes/détails et historiques de chat de la session UI                                                 |
| Cache de fichiers | téléchargements authentifiés temporaires avant sauvegarde/partage                                                                         |
| Firebase SDK      | collecte Analytics uniquement après consentement ; token d'installation pour FCM lorsque les notifications sont activées                  |

Il n'existe pas de mécanisme hors-ligne, de synchronisation différée ni de cache persistant des données métier.

## Configuration et variables d'environnement

| Variable                                       | Usage réel                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`                     | URL de l'API ; défaut émulateur Android `http://10.0.2.2:3000/api`      |
| `EXPO_PUBLIC_CENTER_NAME`                      | nom public validé dans `appConfig`                                      |
| `EXPO_PUBLIC_CENTER_ADDRESS/EMAIL/PHONE/HOURS` | affichage des pages publiques avec valeurs de repli                     |
| `EXPO_PUBLIC_APP_SCHEME`                       | liens profonds reset/paiement ; défaut `plateforme-formations`          |
| `EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED`       | interrupteur de build, désactivé par défaut                             |
| `GOOGLE_SERVICES_JSON`                         | chemin du fichier d'enregistrement Firebase Android injecté s'il existe |
| `GOOGLE_SERVICE_INFO_PLIST`                    | équivalent iOS injecté s'il existe                                      |

`app.json` fixe le package/bundle `com.highskillsacademy.formations`, l'orientation portrait, les plugins et `POST_NOTIFICATIONS`. `firebase.json` désactive la collecte Analytics automatique, le reporting automatique des écrans et l'auto-init Messaging. Le scheme défini dans `app.json` doit rester cohérent avec `EXPO_PUBLIC_APP_SCHEME` et `MOBILE_APP_SCHEME` côté API.

## Principaux flux fonctionnels

### Démarrage et session

```text
Lancement → lecture du refresh token SecureStore
  ├─ absent/invalide → pile Guest
  └─ valide → rotation backend → utilisateur
       ├─ mustChangePassword → pile Password
       └─ sinon → pile App + drawer filtré par rôle
```

### Achat Stripe mobile

1. Le détail de formation appelle `POST /payments/checkout` avec `client: MOBILE` et, en présentiel, `sessionId`.
2. Le système ouvre l'URL Stripe avec `Linking.openURL`.
3. Stripe revient par un lien `plateforme-formations://payments/success|cancel?paymentId=…` produit côté backend sous forme d'Intent Android.
4. `CheckoutReturnScreen` ne fait confiance ni au chemin `success` ni à la présence du lien : il interroge `/payments/:id` toutes les deux secondes tant que le statut est `PENDING`.
5. L'accès au contenu n'est proposé que lorsque le backend renvoie `PAID` avec `enrollmentId`.

### Contenu, progression et documents

- `ContentScreen` charge le contenu autorisé ; les Apprenants marquent les leçons, tandis que `ContentManagementPanel` permet au propriétaire/Admin de gérer modules, leçons et ressources.
- Un lien externe est ouvert par `Linking`; un fichier protégé est téléchargé avec Bearer, puis sauvegardé ou partagé nativement.
- Factures et certificats suivent le même téléchargement protégé.
- Les écrans n'évaluent pas localement l'éligibilité, les scores ou les présences : ils affichent les calculs retournés par l'API.

### Assistants IA

- `TutorChat` envoie mode, message, leçon privilégiée et au plus huit éléments récents ; timeout client de 35 s. L'accès, le retrieval et les citations sont contrôlés par le backend.
- `PublicConcierge` n'est rendu que lorsque `status === 'guest'`. Il envoie au plus quatre messages récents, mais fixe actuellement `currentPath: '/'` quelle que soit la page mobile.
- L'écran Évaluations permet au Formateur de demander des questions IA, puis de les relire/éditer avant publication. Le modèle n'est jamais appelé directement depuis le téléphone.

### Analytics et notifications

- Analytics : si l'interrupteur est actif, un modal demande `granted/denied`. La décision SecureStore commande `setAnalyticsCollectionEnabled`. Les événements manuels sont `screen_view` et les trois événements de recommandation avec ID, catégorie et rang ; aucun événement n'est envoyé avant accord.
- Notifications : après choix explicite, Android 13+ demande `POST_NOTIFICATIONS`, FCM fournit un token enregistré avec l'utilisateur. Les messages foreground sont reproduits via Expo Notifications ; une ouverture accepte uniquement `Catalogue`, `TrainingDetail`, `SessionDetail`, `Purchases` ou `Certificates`.

## Points d'entrée, développement, build et déploiement

- Entrée : `index.ts` appelle `registerRootComponent(App)`.
- Développement : `npm run dev:mobile` à la racine ou `npm start` dans le workspace lance Metro/Expo ; `npm run android --workspace @plateforme-formations/mobile` exécute `expo run:android`.
- Contrôles : `npm run lint`, `typecheck` et `test` dans le workspace. La CI racine les exécute via `npm run check`.
- Build natif : le dossier Android généré utilise Hermes et `newArchEnabled=true`. Le plugin Google Services est appliqué.
- Limite de livraison : il n'existe ni `eas.json`, ni pipeline de publication, ni commande `build` mobile dans `package.json`. La variante `release` Gradle utilise encore la configuration de signature **debug** ; elle n'est donc pas prête pour une distribution de production. Le build racine construit uniquement le backend et le frontend.
- Le parcours de paiement dépend encore du backend Stripe en mode test : l'API n'accepte actuellement que des clés `sk_test_`.

## Patterns, conventions et dépendances

- **Feature-first** : écran et types proches, noyau transversal sous `core`.
- **Provider/Context** : session et drawer ; hook `useAuth` comme façade pour API, refresh et fichiers.
- **Adapter** : `ApiClient`, `RefreshTokenStore`, utilitaires fichiers/Firebase isolent les APIs externes.
- **Navigation déclarative typée** : trois stacks, paramètres TypeScript, deep links et `navigationRef` pour FCM.
- **Server-authoritative** : le client ne calcule ni rôle effectif, ni paiement, ni progression, ni score, ni éligibilité.
- Dépendance structurante : presque toutes les features dépendent de `core/auth`; les écrans publics et le concierge dépendent directement de `core/api`; paiement/certificats dépendent aussi de `core/files`; notifications dépendent de la session et de la navigation globale.

## Pour comprendre rapidement le projet

1. Lire `index.ts`, `src/app/App.tsx`, puis `RootNavigator.tsx` et `navigation/types.ts`.
2. Étudier `core/auth/AuthProvider.tsx`, `mobile-session.ts` et `core/api/client.ts` pour comprendre toutes les communications.
3. Choisir ensuite un dossier `features` et suivre ses appels `/api` vers le backend ; les fichiers `types.ts` donnent la forme attendue.
4. Pour les contraintes natives, lire `app.json`, `app.config.js`, `firebase.json`, puis les modules `core/notifications`, `core/analytics` et `core/files`.
5. Utiliser les tests `mobile-session`, `checkout-return`, `workspace-navigation` et `phase13-feature-flows` comme exemples compacts des scénarios critiques.

## Questions de discussion pour la soutenance

### 1. Pourquoi choisir un monolithe modulaire plutôt que des microservices pour ce périmètre ?

Le Mobile n'embarque aucun service : il consomme une API unique dont les domaines partagent authentification, MongoDB et transactions. Pour ce client, une API unique simplifie la session, les erreurs et les contrats. Côté backend, le paiement doit mettre à jour plusieurs domaines atomiquement ; des microservices ajouteraient cohérence distribuée et opérations réseau sans besoin d'échelle indépendante démontré. La séparation par modules et gateways conserve une possibilité d'évolution.

### 2. Pourquoi l'autorisation est-elle vérifiée dans l'API et pas seulement dans les routes du client ?

Le drawer mobile filtre les liens et certains écrans retournent `null` pour un rôle non autorisé, mais tous les écrans authentifiés sont déclarés dans la même stack. Un téléphone modifié peut aussi appeler l'API sans UI. Le backend recharge donc le compte et vérifie rôle, ownership, affectation et `Enrollment`; la navigation mobile n'est qu'une protection ergonomique.

### 3. Pourquoi l'accès est-il créé après le webhook Stripe plutôt qu'après la redirection utilisateur ?

`CheckoutReturnScreen` illustre ce choix : même pour un lien `/payments/success`, il sonde `/payments/:id` et affiche que seul le webhook accorde l'accès. Une redirection est contrôlée par le navigateur et peut être rejouée. Le backend vérifie la signature Stripe et le snapshot complet, puis crée l'inscription dans une transaction ; le Mobile n'affiche l'accès qu'après `PAID` et `enrollmentId`.

### 4. Comment le système limite-t-il le risque d'hallucination ou de fuite de données dans les assistants IA ?

Le Mobile n'appelle jamais Gemini et ne possède aucune clé IA. Il envoie seulement le message et un historique borné à l'API. Le backend construit les sources autorisées, contrôle l'inscription pour le tuteur, exclut les collections privées du concierge, impose des schémas et valide les citations/liens. Le téléphone affiche le drapeau `grounded` et les sources retournées. Ces mécanismes limitent le risque, mais une validation humaine reste nécessaire pour les questions générées.

### 5. Quelle différence existe-t-il entre le tuteur IA, le concierge public et la génération de questions ?

Dans l'UI mobile, le tuteur appartient au contenu payé et aide l'Apprenant avec citations de leçons. Le concierge n'apparaît qu'en mode invité et oriente vers les informations publiques. La génération de questions se trouve dans l'espace Formateur : elle alimente une évaluation `DRAFT` que le Formateur peut modifier, publier et éventuellement désigner comme certifiante. Ce sont trois endpoints, contextes et autorisations distincts.

### 6. Comment le consentement Firebase est-il respecté et quelles données sont réellement mesurées ?

`firebase.json` désactive la collecte et le reporting automatique. Si `EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED` vaut `true`, le modal enregistre le choix dans SecureStore et active la collecte uniquement après `granted`. Le code émet manuellement le nom de l'écran et les impressions/clics/conversions de recommandations avec ID de formation, catégorie et rang. Il n'ajoute ni nom, e-mail ni montant. Le consentement Analytics est séparé de la permission FCM.

### 7. Quelles limites apparaissent si l'application doit être déployée sur plusieurs instances ?

Le binaire mobile n'est pas « multi-instance », mais il dépend d'un backend répliqué. Aujourd'hui, les limiteurs backend et les fichiers sont locaux à une instance et MongoDB Compose n'a qu'un nœud. Il faudrait une URL HTTPS derrière load balancer, rate limiting partagé, stockage objet et base hautement disponible. Côté client, il faut aussi gérer compatibilité/version d'API, migrations éventuelles des clés SecureStore, rotation de configuration Firebase et comportement lors d'une mise à jour d'application.

### 8. Quelles améliorations prioriser après une évaluation auprès d'utilisateurs réels ?

Corriger en premier les difficultés observées sur petit écran : navigation par rôle, formulaires longs de gestion, choix d'une session, retour du navigateur Stripe, édition des questions et téléchargement Android. Ajouter ensuite, avec consentement, des métriques minimisées sur erreurs/abandons au-delà du seul tunnel de recommandation, puis un vrai mode de livraison : signature release, EAS ou CI native, tests sur appareils, HTTPS, gestion des versions et validation d'accessibilité. Un cache/offline ne doit être ajouté que si l'étude montre ce besoin.
