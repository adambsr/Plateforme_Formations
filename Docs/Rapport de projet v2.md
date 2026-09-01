# High Skills Academy — Rapport technique du projet

## 1. Introduction

### 1.1 Contexte du projet

Le projet est une plateforme numérique de gestion des formations destinée à un centre de formation. Son objectif est de réunir dans un même système les activités opérationnelles, pédagogiques, financières et administratives du centre.

Un centre de formation gère souvent ses informations avec des tableurs, des échanges d'e-mails, des feuilles de présence papier, des certificats générés manuellement et des outils de paiement ou de documentation indépendants. Cette fragmentation entraîne plusieurs difficultés :

- les descriptions de formations et les informations des apprenants sont dupliquées dans plusieurs fichiers ;
- les formateurs ne disposent pas d'un emplacement unique pour gérer les lessons, les plannings et les évaluations ;
- la capacité et les présences sont difficiles à rapprocher ;
- la confirmation du paiement est séparée de l'accès de l'apprenant ;
- les factures et certificats nécessitent une saisie manuelle répétée ;
- les statistiques de gestion sont assemblées manuellement et peuvent contenir des chiffres incohérents ;
- les historiques sont difficiles à rechercher et à préserver.


### 1.2 Motivation

Le projet vise une plateforme pratique, compréhensible dans le cadre d'un projet étudiant, mais appliquant des principes d'ingénierie proches d'une architecture de production. Le modèle métier reste volontairement limité et explicite : il ne reproduit pas tous les workflows possibles de paiement, d'organisation ou de communication.

### 1.3 Objectifs

Les objectifs suivants sont implémentés :

- fournir un accès par rôle pour les Admins, Formateurs et Apprenants ;
- permettre aux Apprenants de découvrir et d'acheter des Formations publiées ;
- prendre en charge les formations en ligne self-paced et les formations en présentiel ;
- organiser les Modules, Lessons, Resources, plannings, présences et progressions ;
- confirmer les paiements Stripe de test au moyen d'un webhook backend signé ;
- donner l'accès aux Apprenants payants grâce à une Enrollment créée par le webhook ;
- prendre en charge les Évaluations objectives et la génération contrôlée de brouillons avec Gemini ;
- produire des Certificats protégés et idempotents ainsi que des Factures générées automatiquement ;
- recueillir une note Feedback unique de 1 à 5 pour chaque Enrollment éligible ;
- fournir à l'Admin des statistiques, des coûts explicites, des revenus, un résultat et des indicateurs de rentabilité ;
- conserver les historiques importants et protéger les fichiers envoyés.


## 2. Vision du projet

La plateforme est un espace de travail numérique centralisé pour un centre de formation. Elle relie le catalogue public, l'accès des Apprenants, le contenu pédagogique, la logistique du présentiel, les Formateurs, les paiements, les évaluations, les certificats et les rapports de gestion dans un backend commun.

La valeur principale est la continuité du cycle de formation :

```text
Conception de la Formation
    ↓
Catalogue publié
    ↓
Checkout Stripe de test
    ↓
Webhook vérifié
    ↓
Enrollment payée et accès
    ↓
Apprentissage, planning, présence et évaluation
    ↓
Certificat, Feedback, facture et statistiques
```


## 3. Acteurs et rôles

Le système possède exactement trois rôles applicatifs. Chaque User possède un seul rôle.

### 3.1 Admin

L'Admin est le responsable opérationnel du centre. Les fonctions Admin implémentées dans le backend et l'application Web comprennent :

- la gestion des comptes Apprenants et Formateurs ;
- la création, la modification, la désactivation et le transfert de propriété des Formateurs ;
- la création et la gestion des Training Categories et des Trainings ;
- la gestion des Modules, Lessons, Resources, Sessions, plannings et affectations ;
- la consultation des Enrollments, Payments, Invoices, Certificates, Feedbacks et statistiques ;
- la saisie ou la supervision des présences ;
- la supervision et l'archivage des Evaluations ;
- la saisie des coûts mensuels des Formateurs et des coûts de Formation ;
- la consultation de la rentabilité et des agrégats du tableau de bord.

Le premier Admin est créé par un seed CLI idempotent. La base contient un index Admin unique partiel, ce qui empêche plusieurs enregistrements Admin dans le MVP actuel. Il n'existe pas d'inscription publique Admin.

### 3.2 Formateur

Les Formateurs sont recrutés et créés par l'Admin ; il n'existe pas d'inscription publique Formateur. Un nouveau Formateur reçoit un mot de passe temporaire qu'il doit modifier avant d'accéder aux fonctionnalités protégées.

Lorsqu'un Formateur crée une Formation, il en devient l'unique propriétaire. Le propriétaire peut gérer le cycle de vie, le contenu et les Evaluations de la Formation. L'Admin peut transférer la propriété. Un Formateur affecté à une Session reçoit des permissions opérationnelles : lecture du contenu nécessaire, gestion des plannings autorisés, consultation des Apprenants, démarrage/achèvement de la Session selon les règles et saisie des présences. L'affectation à une Session ne permet pas de modifier la Formation parente ou ses Evaluations.

### 3.3 Apprenant

Les Apprenants s'inscrivent publiquement avec le rôle Apprenant uniquement. Ils peuvent :

- parcourir les Trainings publiés et les Sessions présentielles disponibles ;
- acheter une Formation ou une Session via Stripe Checkout ;
- consulter leurs propres informations de Payment, Enrollment et Invoice ;
- accéder au contenu uniquement après la création d'une Enrollment par un webhook de paiement réussi ;
- terminer des Lessons self-paced et consulter leur progression calculée ;
- consulter les plannings et présences du présentiel ;
- passer les Evaluations accessibles et consulter les résultats ;
- demander les Certificates éligibles et télécharger leurs PDF protégés ;
- envoyer une note Feedback immuable de 1 à 5 après la complétion et la réussite éventuelle de l'Évaluation certifiante.

### 3.4 Limite d'autorisation

L'authentification identifie l'utilisateur, mais chaque opération sensible vérifie également le rôle, la propriété, l'affectation, l'état actif du compte et les relations entre les enregistrements dans le backend. Les guards Web améliorent l'expérience utilisateur, mais ne constituent pas une barrière de sécurité. Un Apprenant ne peut pas lire les données d'un autre Apprenant, un Formateur ne peut pas accéder aux données financières et un Formateur affecté ne peut pas modifier le contenu des Trainings ou des Evaluations appartenant au propriétaire.

## 4. Vue fonctionnelle

### 4.1 Authentification et inscription Apprenant — Implémenté


Le premier Admin est créé avec `npm run seed:admin`. Le seed de développement fournit également des comptes et des données de démonstration locales, mais il est destructif et limité à la base de développement locale.

### 4.2 Gestion des Formateurs et Apprenants — Implémenté

Les écrans Web Admin prennent en charge la création, la modification, la désactivation des Formateurs et la liste des utilisateurs. Les services backend imposent le cycle Formateur réservé à l'Admin, la vérification des comptes actifs, l'unicité de l'e-mail normalisé et le changement obligatoire du premier mot de passe.

### 4.3 Gestion des Trainings et catégories — Implémenté

Les Training Categories et Trainings disposent de modèles backend, validations, indexes, cycle de vie, propriété, filtrage, pagination et écrans Web de gestion. Les types de Formation sont immuables :

- `SELF_PACED_ONLINE` ;
- `IN_PERSON`.

Les prix sont des montants positifs entiers en unités mineures TND. Une Formation self-paced ne peut pas être publiée sans contenu actif. Une Formation présentielle peut être publiée avant la création d'une Session, mais le Checkout exige une Session planifiée disponible.

### 4.4 Modules, Lessons et Resources — Implémenté


### 4.5 Apprentissage self-paced — Implémenté côté Web/backend

Les Apprenants self-paced payants peuvent lire le contenu autorisé et marquer des Lessons comme terminées ou non terminées. La progression appartient à l'Enrollment et est calculée à partir des Lessons actives applicables. Elle atteint 100 % uniquement lorsque toutes les Lessons applicables sont terminées. La progression utilisée par un Certificate devient immuable après son émission.

### 4.6 Sessions présentielles et planning — Implémenté côté Web/backend

Une Formation présentielle peut posséder plusieurs Sessions. Une Session peut contenir autant d'entrées `SessionSchedule` que nécessaire ; une formation de dix dates en avril est donc une Session contenant dix plannings, et non dix Sessions différentes.

Les règles implémentées comprennent :

- les états `PLANNED`, `IN_PROGRESS`, `COMPLETED` et `CANCELLED` ;
- la capacité et un contrôle atomique des places inscrites ;
- plusieurs Formateurs affectés ;
- le lieu et la salle facultative ;
- la détection des chevauchements pour un même Formateur ou un même lieu/salle normalisé ;
- l'autorisation de plages adjacentes ;
- la persistance UTC avec saisie et affichage en Africa/Tunis ;
- l'achèvement d'une Session seulement après couverture complète des présences ;
- le blocage de l'annulation après création d'une Enrollment.

### 4.7 Enrollments et accès — Implémenté

Le modèle Enrollment est volontairement simple. Il ne possède ni état de paiement ni état d'annulation. Une tentative Payment peut être `PENDING`, `PAID`, `FAILED` ou `CANCELLED`, mais seule la confirmation réussie par webhook crée une Enrollment et accorde l'accès.

Des indexes uniques empêchent les Enrollments équivalentes. Une Enrollment self-paced cible une Formation ; une Enrollment présentielle cible une Session et sa Formation. Il n'existe pas d'entité SeatReservation, de concept métier Impayé, de workflow de remboursement ni d'opération d'annulation d'Enrollment.

### 4.8 Présences — Implémenté

Une Attendance est unique par Enrollment et SessionSchedule. Seuls `PRESENT` et `ABSENT` sont valides. Une absence de record reste une absence de saisie et n'est pas transformée silencieusement en `ABSENT`. Le pourcentage correspond aux présences `PRESENT` divisées par les entrées de planning de la Session. Le seuil de certification présentielle par défaut est 80 %, configurable sur la Formation.

### 4.9 Paiements et Stripe — Implémenté en mode test

L'Apprenant demande une Session Checkout au backend. Le backend lit le prix de référence de la Formation, crée un Payment technique et redirige l'Apprenant vers le Checkout Stripe hébergé. Un webhook à corps brut vérifie la signature Stripe et confirme le montant, la devise, l'Apprenant, la Formation et la Session.

Le traitement réussi est transactionnel et idempotent. Il crée exactement une Enrollment et une Invoice, et applique le contrôle atomique de capacité de la Session. Les tentatives échouées ou annulées restent dans l'historique technique des Payments et ne créent ni Enrollment ni Invoice. Aucune donnée de carte n'est stockée.

Seules les clés Stripe de test sont acceptées par le validateur d'environnement. La disponibilité d'un compte Stripe de production pour une entité tunisienne est une vérification future distincte.

### 4.10 Factures — Implémenté

Chaque Payment réussi crée une Invoice et un InvoiceItem. La Facture contient des instantanés immuables de l'Apprenant, de la description de l'achat, du montant, de la devise, de l'identité du centre et de la date d'émission. La devise est le TND ; aucun calcul de taxe n'est implémenté, donc le sous-total et le total sont égaux. Les PDF sont générés et servis par un stockage protégé par autorisation.

### 4.11 Evaluations et quiz — Implémenté

Les Evaluations sont contrôlées par le propriétaire et suivent le cycle `DRAFT → PUBLISHED → ARCHIVED`. Les types de questions objectives pris en charge sont `SINGLE_CHOICE`, `MULTIPLE_CHOICE` et `TRUE_FALSE`.

Le backend valide les questions, le nombre de tentatives, le seuil de réussite, la durée facultative et les conditions de publication. Les tentatives utilisent les timestamps du serveur. Les tentatives soumises ou expirées sont immuables. La correction attribue tous les points ou zéro ; pour une question à choix multiples, l'ensemble des réponses doit correspondre exactement aux bonnes réponses. Les bonnes réponses et explications restent masquées jusqu'à une réussite ou à la dernière tentative autorisée.

### 4.12 Génération d'Evaluation assistée par IA — Implémenté côté backend/Web

L'implémentation utilise Google Gemini via l'intégration backend `@google/genai`. Les Modules, Lessons et Resources textuelles compatibles de la Formation sélectionnée fournissent le contexte. Les formats d'extraction pris en charge sont PDF textuel, DOCX, PPTX et TXT.

Le contexte est limité par `AI_MAX_CONTEXT_CHARS`. Le backend envoie un schéma JSON strict, valide de nouveau la réponse avec les règles DTO des questions et importe uniquement des questions modifiables dans un brouillon. Le Formateur doit relire et publier l'Evaluation. L'IA ne peut pas publier, désigner une Evaluation certifiante, explorer des URLs externes, réaliser d'OCR ou accéder aux données d'Apprenants, de présence, de paiement ou d'autres Trainings.

### 4.13 Certificates — Implémenté

L'éligibilité au Certificate est calculée par un service central. Elle exige :

- une Enrollment payée valide ;
- la complétion self-paced ou l'Attendance présentielle au seuil configuré ;
- la réussite d'une Evaluation certifiante lorsqu'elle est configurée.

La génération est idempotente par Enrollment. Le numéro du Certificate, les instantanés de l'Apprenant et de la Formation, les preuves d'éligibilité, l'identité du centre et la référence du PDF protégé sont conservés. Les requêtes répétées renvoient le Certificate existant ; régénérer le PDF ne crée pas un autre Certificate.

Il n'existe pas d'Attestation ni de document hybride certificat/attestation.

### 4.14 Feedback — Implémenté


### 4.15 Coûts, statistiques et rentabilité — Implémenté

L'Admin peut enregistrer un `TrainerCost` mensuel par Formateur/année/mois et créer des `TrainingCost` datés explicitement, éventuellement liés à une Session. Aucun salaire n'est déduit ou réparti automatiquement.

Le tableau de bord calcule :

```text
revenu confirmé = montants des Payments payés
résultat         = revenu confirmé - TrainerCost sélectionnés - TrainingCost explicites
rentabilité      = résultat / revenu confirmé × 100
```

Lorsque le revenu est nul, la rentabilité vaut `null`. Les agrégats couvrent les volumes opérationnels, la participation, la progression self-paced, les résultats d'Evaluations, la satisfaction, les revenus, les coûts, le résultat et la rentabilité sur des périodes calendaires Africa/Tunis.

### 4.16 Notifications et contact — Partiel

Les e-mails SMTP de réinitialisation du mot de passe et le formulaire public de contact sont implémentés. Il n'existe pas de module général de notification de cours, de rappel de présence, de rappel de paiement ou de marketing.


### 4.17 Firebase Analytics Web — Implémenté en option

Le client Web intègre Firebase Analytics de manière optionnelle et désactivée par défaut. Lorsque `VITE_FIREBASE_ANALYTICS_ENABLED=true` et que les identifiants publics Firebase sont fournis dans `Web/frontend/.env`, un tracker suit les changements de route React Router et enregistre une vue de page unique.

Cette intégration ne modifie ni l'API ni la base de données et n'envoie aucune adresse e-mail, identifiant utilisateur, référence de paiement ou autre donnée personnelle. Firebase Auth, Firestore, Storage, Cloud Functions et Firebase Cloud Messaging ne sont pas utilisés.

### 4.18 Frontière de production

Le déploiement cloud, le stockage objet, la supervision et les sauvegardes automatisées restent à préparer. Firebase Analytics ne constitue pas un backend cloud et Stripe reste limité à la Sandbox de test jusqu'à la validation d'un compte de production.
## 5. Modèle de Formation

Le modèle de contenu implémenté est :

```text
Training
   ↓
TrainingModule
   ↓
Lesson
   ↓
TrainingResource
```

Training contient sa catégorie, son type immuable, son prix positif en TND, son Formateur propriétaire, son statut et les paramètres facultatifs de présence/certification. Les Modules et Lessons conservent les références à la Formation parente afin que l'autorisation, les suppressions et la construction du contexte IA soient vérifiables sans faire confiance aux identifiants fournis par le client.

### 5.1 Formation en ligne / self-paced

Une Formation self-paced est organisée en Modules et Lessons. Une Lesson peut contenir du texte, des instructions, des liens et des Resources. Les Resources peuvent être des fichiers protégés tels que des PDF et documents, images, tableurs, archives et fichiers texte, ou des URLs HTTP(S) externes. L'hébergement vidéo et le streaming propriétaire ne sont pas implémentés ; les liens vidéo restent des ressources externes.

L'Apprenant accède au contenu uniquement avec une Enrollment payée. La progression est stockée dans `LessonProgress`, unique par Enrollment et Lesson. Le pourcentage est calculé par le serveur et évolue lorsque le contenu applicable change, sauf pour l'historique d'éligibilité d'un Certificate déjà délivré.

### 5.2 Formation présentielle

Une Formation présentielle utilise des documents `TrainingSession` et `SessionSchedule` distincts. Une Session contient sa capacité, ses Formateurs affectés, son lieu, sa salle, son statut et son compteur d'inscrits. Les plannings enregistrent les instants de début et de fin, les associations de contenu facultatives et les informations de date dérivées de la Session.

L'Attendance est liée à chaque Enrollment et à chaque occurrence de planning. Cette séparation permet à une Formation d'avoir plusieurs sessions et à une session de s'étendre sur plusieurs dates tout en conservant des capacités, plannings, affectations, Enrollments et historiques de présence indépendants.

### 5.3 Pourquoi séparer Training et Session

Training est la définition pédagogique et commerciale réutilisable. Session est une occurrence particulière de formation présentielle. Cette séparation évite de dupliquer le contenu pour chaque date et permet à plusieurs Sessions d'une même Formation d'avoir des dates, capacités, Formateurs, salles, Enrollments et présences différents.

## 6. Evaluation et certification

La relation apprentissage-certification implémentée est :

```text
Training
    ↓
Enrollment payée
    ↓
Lessons / Attendance de Session
    ↓
Evaluation / Quiz
    ↓
Calcul d'éligibilité
    ↓
PDF du Certificate
    ↓
Note Feedback
```

Le propriétaire de la Formation crée les Evaluations et les questions en brouillon. Il peut relire les brouillons générés par l'IA, ajouter ou supprimer des questions, modifier les bonnes réponses et les points, puis publier uniquement après validation backend. L'Admin peut superviser et archiver les Evaluations.


## 7. Modèle financier

### 7.1 Revenus

Les revenus sont constitués des Payments réussis des Learners. Le modèle Payment conserve le montant positif en unités mineures TND et les références Stripe. Les tentatives `PENDING`, `FAILED` et `CANCELLED` ne sont pas comptabilisées comme revenus.

### 7.2 Coûts

Les types de coûts implémentés sont :

- `TrainerCost` fixe mensuel saisi par l'Admin ;
- `TrainingCost` explicite et daté, éventuellement rattaché à une Session.

Le système n'infère pas les salaires à partir des heures, Sessions, propriétaires, Learners ou revenus. Il ne répartit pas le salaire fixe d'un Formateur sur des Trainings individuels.

### 7.3 Checkout, webhook et factures

Le Web lance le Checkout via `/api/payments/checkout`. Le backend vérifie la cible publiée, le prix TND détenu par le serveur, l'absence d'Enrollment équivalente et la disponibilité de la Session. Stripe envoie un événement à `/api/payments/webhook/stripe`; la signature et l'exécution transactionnelle sont vérifiées côté backend.

Les cardinalités Payment/Enrollment/Invoice sont :

```text
Payment réussi 1 ─── 1 Enrollment
Payment réussi 1 ─── 1 Invoice
Invoice         1 ─── 1 InvoiceItem
Enrollment      1 ─── 0..1 Certificate
Enrollment      1 ─── 0..1 Feedback
```

Il n'y a pas de calcul de taxe, de workflow de remboursement, d'avoir, de Formation gratuite ni d'annulation d'Enrollment.


Le Web utilise également Firebase Analytics de façon facultative pour les vues de pages côté client ; les décisions métier, paiements, autorisations et données restent gérés par le backend.

## 8. Architecture du système

### 8.1 Architecture logique

```text
React Web ───────────────┐
                         ├── API REST ── Node.js/Express ── Mongoose ── MongoDB
                                                   ├── Volume local persistant de fichiers
                                                   ├── API/webhook Stripe de test
                                                   ├── API Gemini
                                                   ├── SMTP/Mailpit pour le développement
                                                   └── Génération de PDF avec PDFKit
```


### 8.2 Structure backend

Le backend suit une organisation par modules routes/contrôleurs/services/modèles. L'application Express compose les modules Auth, Users, Trainings, Content, Sessions, Payments, Enrollments, Progress, Attendance, Evaluations, Feedback, Certificates, Invoices, Costs, Dashboard et Contact.

Les contrôleurs et routes traduisent les requêtes HTTP et invoquent les services. Les DTOs Zod valident les entrées. Les services appliquent propriété, rôle, transitions, transactions et calculs dérivés. Les modèles Mongoose définissent des schémas stricts et des indexes. Des middlewares partagés fournissent authentification, limitation de débit, logs, en-têtes de sécurité, gestion des erreurs et CORS.

### 8.3 Base de données et persistance

MongoDB fonctionne comme un replica set à nœud unique dans Compose. Cette configuration permet les transactions pour l'acquittement des paiements, l'import de questions IA, le verrouillage de complétion des présences et d'autres opérations sensibles à la cohérence. Le backend initialise les indexes avant d'écouter les requêtes.

### 8.4 Stockage des fichiers

Les fichiers locaux sont stockés sous `UPLOAD_DIR`, normalement sauvegardé par le volume Compose `backend_uploads`. Les Resources, PDF d'Invoice et PDF de Certificate ne sont pas servis comme fichiers statiques publics. L'API effectue un streaming uniquement après autorisation et ne renvoie pas les chemins internes.

### 8.5 Services externes

- Stripe est utilisé en mode test pour le Checkout hébergé et les webhooks signés ;
- Gemini est utilisé uniquement par le backend pour la génération de brouillons d'Evaluations ;
- Mailpit capture les e-mails SMTP en développement ;
- Docker Compose fournit MongoDB, l'initialisation du replica set, Mailpit et le backend.

## 9. Technologies effectivement utilisées

Les versions ci-dessous proviennent des manifestes de paquets et de la configuration Docker, et non d'une supposition issue de la feuille de route.

| Technologie      |                       Version du dépôt | Utilisation                                   |
| ---------------- | -------------------------------------: | --------------------------------------------- |
| Node.js          | 24.19.0 dans Docker ; Node >=24 requis | Runtime backend et outils du workspace        |
| npm              |                                11.17.0 | Gestion des paquets et workspaces             |
| React DOM        |                                 19.2.8 | Rendu Web                                     |
| Vite             |                                  8.2.x | Serveur de développement et build Web         |
| React Router     |                                  8.3.x | Routage et navigation protégée Web            |
| React Hook Form  |                                 7.85.x | État des formulaires Web                      |
| Express          |                                  5.2.1 | Backend REST                                  |
| MongoDB          |                    image Docker 8.0.29 | Persistance et replica set transactionnel     |
| Mongoose         |                                  9.9.3 | Schémas, modèles et indexes MongoDB           |
| Zod              |                                  4.4.3 | Validation de l'environnement et des DTOs     |
| jose             |                                  6.2.5 | Signature et vérification JWT                 |
| Stripe           |                                 22.5.0 | Checkout et webhooks de test                  |
| Google GenAI     |                                 2.18.0 | Gateway de génération Gemini                  |
| PDFKit           |                                 0.19.1 | PDF d'Invoice et de Certificate               |
| pdf-parse        |                                  2.4.5 | Extraction de PDF textuels                    |
| Multer           |                                  2.2.0 | Uploads multipart                             |
| file-type        |                                 22.0.2 | Validation de signature fichier               |
| fflate           |                                  0.8.3 | Extraction XML DOCX/PPTX                      |
| Nodemailer       |                                  9.0.5 | Envoi SMTP                                    |
| Pino / pino-http |                        10.3.1 / 11.0.0 | Logs structurés et nettoyés                   |
| Swagger UI       |                                  5.0.1 | Interface OpenAPI                             |
| Lucide           |                                 1.33.0 | Iconographie Web                              |
| Vitest           |                                 4.1.11 | Tests backend et Web                          |
| Supertest        |                                  7.2.1 | Tests HTTP backend                            |
| Testing Library  |                                 16.3.2 | Tests de composants Web                       |
| Oxlint           |                                 1.79.0 | Linting                                       |
| Prettier         |                                  3.9.6 | Formatage                                     |

Aucune bibliothèque de graphiques dédiée n'est installée. Les visualisations du tableau de bord utilisent les composants React et le CSS existants.

## 10. Architecture de la base de données

### 10.1 Collections

Le backend initialise les collections/modèles Mongoose suivants :

| Collection/modèle      | Rôle                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `users`                | Utilisateurs, rôles, état actif, hash de mot de passe et profil commun intégré |
| `refreshsessions`      | Refresh tokens hachés, rotation et révocation                                  |
| `passwordresettokens`  | Tokens de reset hachés et expirants                                            |
| `trainingcategories`   | Catégories du catalogue                                                        |
| `trainings`            | Définition, propriétaire, type, prix, statut et certification                  |
| `training_modules`     | Modules ordonnés                                                               |
| `lessons`              | Contenu ordonné et références parentes                                         |
| `training_resources`   | Métadonnées de fichiers protégés ou d'URLs externes                            |
| `training_sessions`    | Occurrences présentielles et capacité                                          |
| `session_schedules`    | Dates et heures individuelles                                                  |
| `payments`             | Tentatives Stripe techniques et transactions réussies                          |
| `enrollments`          | Accès payant                                                                   |
| `invoices`             | Entêtes de factures et instantanés immuables                                   |
| `invoice_items`        | Lignes d'achat                                                                 |
| `lesson_progress`      | Complétion des Lessons par Enrollment                                          |
| `attendance`           | Présences par Enrollment et planning                                           |
| `evaluations`          | Cycle de vie et configuration des Evaluations                                  |
| `evaluation_questions` | Questions objectives                                                           |
| `evaluation_attempts`  | Tentatives, scores et états                                                    |
| `evaluation_answers`   | Instantanés des réponses et points                                             |
| `certificates`         | Numéro, éligibilité, identité du centre et PDF                                 |
| `feedback`             | Note immuable par Enrollment éligible                                          |
| `trainercosts`         | Coûts mensuels des Formateurs                                                  |
| `trainingcosts`        | Dépenses explicites de Formation/Session                                       |

Il n'existe pas de collections TrainerProfile ou LearnerProfile séparées dans l'implémentation actuelle ; les noms et prénoms communs sont intégrés dans User. Il n'existe pas non plus de Tenant, OrganizationMembership, SiteSettings, CompanySettings, SeatReservation, Unpaid, Refund ou collection d'états d'Enrollment.

### 10.2 Relations

```text
Training 1 ─── N TrainingModule 1 ─── N Lesson 1 ─── N TrainingResource
Training 1 ─── N TrainingSession 1 ─── N SessionSchedule
Training 1 ─── N Evaluation 1 ─── N EvaluationQuestion
Training 1 ─── N TrainingCost
Trainer 1 ─── N Training propriétaire
Trainer N ─── N TrainingSession affectée
Learner 1 ─── N Payment
Learner 1 ─── N Enrollment
Enrollment 1 ─── N LessonProgress
Enrollment 1 ─── N Attendance
Enrollment 1 ─── 1 Payment réussi
Payment 1 ─── 1 Invoice 1 ─── 1 InvoiceItem
Enrollment 1 ─── 0..1 Certificate
Enrollment 1 ─── 0..1 Feedback
Trainer 1 ─── N TrainerCost
```

L'application stocke des références plutôt que d'embarquer toute la hiérarchie de contenu. Les identifiants parents sont répétés lorsqu'ils améliorent l'autorisation, le filtrage ou les agrégations.

### 10.3 Indexes et intégrité

Les indexes uniques et de recherche couvrent notamment l'e-mail User normalisé, l'unique Admin, l'identifiant Stripe Checkout, les relations Payment/Enrollment/Invoice, les Enrollments équivalentes, le numéro d'Invoice, le numéro de Certificate, le Certificate par Enrollment, le Feedback par Enrollment, la progression par Enrollment/Lesson, l'Attendance par Enrollment/Schedule, les coûts Formateur/mois, les listings de Trainings/Sessions, la propriété, les statuts et les rapports financiers.

Les transactions sont utilisées lorsque plusieurs documents doivent évoluer ensemble, notamment pour le fulfillment Stripe réussi et l'import de questions IA. L'initialisation des indexes MongoDB est exécutée explicitement dans `server.ts` avant l'écoute HTTP.

## 11. Authentification et sécurité

### 11.1 Tokens et sessions


MongoDB ne stocke que les empreintes des tokens. La déconnexion révoque la session courante. Le changement ou le reset du mot de passe ainsi que la désactivation du compte révoquent toutes les sessions. Chaque requête protégée relit le User et vérifie que le compte est actif.

### 11.2 Mots de passe et reset

Les mots de passe sont hachés par l'utilitaire partagé. Les tokens de reset sont hachés, à usage unique et expirent après la période configurée de 30 minutes. Les identifiants SMTP sont chargés par variables d'environnement et ne sont jamais codés en dur.

### 11.3 Autorisation backend

Les vérifications d'autorisation sont présentes dans les middlewares et services. Elles comprennent notamment :

- création de Formateurs, désactivation, coûts et tableau de bord réservés à l'Admin ;
- édition du contenu et des Evaluations réservée au propriétaire ;
- opérations de Session et Attendance réservées aux Formateurs affectés ;
- Payments, Enrollments, Progress, tentatives, Feedbacks et Certificates limités au Learner concerné ;
- contrôle d'une Enrollment payée avant l'accès au contenu ;
- éligibilité Certificate et confirmation Stripe décidées uniquement par le backend.

### 11.4 Protection HTTP et des entrées

Express désactive `X-Powered-By` et définit des en-têtes de sécurité, notamment les options de type de contenu, le refus d'iframe, la politique de referer, la politique de permissions, la politique d'opener et HSTS en production. Les origines CORS et les credentials sont configurés par l'environnement. Zod valide l'environnement et les requêtes. Les endpoints sensibles utilisent une limitation de débit. Les logs Pino évitent les secrets bruts.

Les routes de fichiers vérifient les noms de stockage, MIME/signature, taille, checksum et autorisation. Les chemins internes ne sont pas renvoyés comme URLs publiques.

La protection des routes frontend ne suffit pas, car un client malveillant peut la contourner. Le backend répète donc toutes les vérifications de rôle, propriété, compte, paiement et éligibilité.

## 12. Architecture API

L'API est REST sous `/api`. Les routes sont organisées par domaine et utilisent JSON, sauf pour les uploads multipart et les flux de téléchargement protégés. Les contrôleurs délèguent aux services ; validation et autorisation sont effectuées avant la persistance ; le middleware d'erreur centralisé renvoie un contrat stable.

### 12.1 Domaines API principaux

```text
/api/health
/api/openapi.json
/api/docs
/api/auth
/api/users
/api/trainers
/api/learners
/api/categories
/api/trainings
/api/modules
/api/lessons
/api/resources
/api/sessions
/api/schedules
/api/enrollments
/api/progress
/api/attendance
/api/payments
/api/invoices
/api/evaluations
/api/feedback
/api/certificates
/api/costs
/api/dashboard
/api/contact
```

Les opérations principales comprennent l'inscription/connexion/refresh/logout/reset, le CRUD et le cycle de vie des Trainings et contenus, la gestion des Sessions/plannings/affectations, la lecture et saisie groupée des présences, le Checkout et le webhook Stripe, la consultation des Enrollments et Progress, la création/génération/publication/tentative/résultat des Evaluations, la génération et le téléchargement des Certificates, la soumission des Feedbacks, la gestion des coûts et les agrégations du tableau de bord.

Le document OpenAPI est généré dans le code et servi en JSON ainsi que par Swagger UI. Des tests vérifient la synchronisation des routes documentées et des contrats de phases.

## 13. Architecture frontend Web

Le client Web est une application React TypeScript construite avec Vite. Il utilise React Router, un contexte d'authentification en mémoire, un client API basé sur Fetch, React Hook Form, la validation Zod dans les formulaires, des composants partagés, les icônes Lucide et le CSS de `src/shared/styles/global.css`.

### 13.1 Expérience publique

Les routes publiques implémentées comprennent :

- page d'accueil ;
- catalogue et détail d'une Formation ;
- pages À propos, FAQ et Contact ;
- connexion et inscription Apprenant ;
- demande et finalisation de reset du mot de passe ;
- pages de retour du Checkout Stripe.

### 13.2 Espace authentifié


Les interfaces gèrent les états de chargement, vide, validation, erreur, conflit, pagination et retry dans les fonctionnalités implémentées. Elles affichent les horaires en heure locale Africa/Tunis tandis que l'API échange des timestamps ISO en UTC.

## 14. Docker et environnement de développement

Docker sert à rendre reproductibles MongoDB transactionnel, le runtime backend, le volume de fichiers protégés et le service mail local.


Les tests Web couvrent le tracker Firebase Analytics : absence d'initialisation sans configuration, tolérance aux navigateurs incompatibles et absence de doublon lors d'une navigation identique.

## 15. Stratégie de tests

### 15.1 Tests backend

Les tests Vitest backend couvrent la configuration, les logs, les mots de passe, les erreurs, OpenAPI, les indexes, les seeds, l'extraction de documents, le gateway Stripe et les cycles d'intégration par phase. Supertest exerce le middleware HTTP réel lorsqu'un replica set MongoDB de test est disponible.

Les workflows critiques testés comprennent :

- inscription Learner et création de Trainer réservée à l'Admin ;
- cycle JWT/refresh/mot de passe ;
- propriété Training, publication, prix TND positif et type immuable ;
- contenu, fichiers protégés et contraintes d'archivage/suppression ;
- Sessions multi-dates, affectation, conflits, capacité et cycle de vie ;
- webhook Stripe signé, fulfillment et idempotence ;
- accès Enrollment, Invoices et contenu PDF ;
- progression et complétion Attendance ;
- tentatives, expiration, correction et révélation des réponses ;
- extraction/contexte Gemini et génération limitée aux brouillons ;
- éligibilité/idempotence Certificate ;
- éligibilité/unicité Feedback ;
- agrégations de coûts et tableau de bord.

### 15.2 Tests Web

Les tests React Testing Library/Vitest couvrent les routes, écrans d'authentification, catalogue public, contenu, Sessions, Attendance, Payments, Progress, Evaluations, Certificates/Feedbacks, gestion des utilisateurs, Dashboard, client API et pagination. Le build Web de production a réussi pendant la vérification.

## 16. Performance et évolutivité

Les mesures implémentées comprennent :

- des indexes MongoDB pour le catalogue, la propriété, les statuts, les plannings, les Payments, les Enrollments et les rapports financiers ;
- la pagination des listes importantes ;
- une limite de contexte IA et une taille maximale d'upload ;
- des agrégations serveur pour les statistiques au lieu de charger tous les documents dans le client Web ;
- le streaming protégé des fichiers et PDF ;
- des layouts Web responsive et des états de chargement par fonctionnalité ;
- le calcul serveur de la complétion, de la présence, de l'éligibilité et de la rentabilité.

Aucun cache général, queue, worker de fond, stockage distribué ou scaling horizontal n'est implémenté. Le stockage de fichiers suppose une instance backend et un volume persistant. Le scaling cloud et le stockage objet restent des travaux futurs.

## 17. Workflows de bout en bout

### 17.1 Apprenant en ligne — implémenté côté Web/backend

```text
Visiteur
  ↓
Inscription Apprenant
  ↓
Connexion
  ↓
Catalogue self-paced publié
  ↓
Le backend crée le Checkout Stripe et le Payment technique PENDING
  ↓
Checkout Stripe de test
  ↓
Webhook Stripe vérifié
  ↓
Le backend crée Payment PAID, Enrollment, Invoice et InvoiceItem
  ↓
Accès aux Modules/Lessons/Resources
  ↓
Le Learner termine les Lessons
  ↓
Passage de l'Evaluation accessible
  ↓
Vérification de complétion et d'Evaluation certifiante
  ↓
Génération/téléchargement du Certificate
  ↓
Une note Feedback éligible de 1 à 5
```

La redirection du navigateur n'accorde pas l'accès. Le webhook backend fait autorité.

### 17.2 Apprenant en présentiel — implémenté côté Web/backend

```text
Visiteur
  ↓
Inscription et connexion Apprenant
  ↓
Catalogue de la Formation présentielle
  ↓
Sélection d'une Session planifiée disponible
  ↓
Checkout Stripe de test
  ↓
Le webhook vérifié crée Enrollment et Invoice
  ↓
Participation aux dates de la Session
  ↓
Admin/Formateur affecté saisit PRESENT ou ABSENT
  ↓
Couverture complète des présences et état COMPLETED
  ↓
Réussite de l'Evaluation obligatoire éventuelle
  ↓
Génération/téléchargement du Certificate
  ↓
Une note Feedback éligible de 1 à 5
```

### 17.3 Formateur — implémenté côté Web/backend

```text
Admin crée le Formateur
  ↓
Le Formateur change son mot de passe temporaire
  ↓
Le Formateur crée ou ouvre une Formation dont il est propriétaire
  ↓
Gestion des Modules, Lessons et Resources
  ↓
Création d'une Evaluation en brouillon
  ↓
Génération Gemini facultative
  ↓
Relecture, modification et publication par le Formateur
  ↓
Création des Sessions et affectation des Formateurs
  ↓
Gestion des opérations et présences autorisées
  ↓
Consultation des résultats Learner/Evaluation pertinents
```

### 17.4 Admin — implémenté côté Web/backend

```text
Seed/connexion Admin
  ↓
Gestion des Users et Formateurs
  ↓
Gestion des Categories, Trainings, contenus, Sessions et propriétaires
  ↓
Supervision des Enrollments, Payments, Invoices, Attendance, Evaluations et Certificates
  ↓
Saisie des coûts Trainer et Training
  ↓
Consultation des dashboards opérationnel, satisfaction, financier et rentabilité
```

## 18. Conclusion du rapport

Le problème initial était la fragmentation des opérations d'un centre de formation entre tableurs, e-mails, documents papier, documents générés manuellement et processus de paiement déconnectés. La solution implémentée centralise ces activités dans un backend Node.js/MongoDB modulaire et un client React Web complet.

La plateforme prend en charge le cycle Web/backend des Trainings, l'apprentissage self-paced, les Sessions présentielles multi-dates, les Enrollments confirmées par paiement, les Attendance, les Evaluations objectives, la génération Gemini contrôlée, les Certificates, les Feedbacks, les Invoices, les coûts explicites et les statistiques de rentabilité Admin. Elle utilise TypeScript strict, l'autorisation backend par rôle, les webhooks Stripe signés, les indexes et transactions MongoDB, les fichiers locaux protégés, les PDF générés, OpenAPI, les tests automatisés et l'infrastructure Docker de développement.