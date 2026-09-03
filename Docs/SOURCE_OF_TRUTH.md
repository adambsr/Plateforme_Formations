# High Skills Academy — Plateforme web de gestion des formations

## Source of Truth — Spécification fonctionnelle et technique actuelle

> **Statut :** document de référence unique de la version web actuelle.
> **Règle fondamentale :** le code et la configuration du dépôt constituent la preuve d'implémentation; ce document formalise les règles et comportements à maintenir. Toute nouvelle décision doit mettre à jour les deux avant de devenir une référence.

---

# 1. Contexte du projet

Les centres de formation ont besoin de centraliser la gestion de leurs formations, contenus pédagogiques, formateurs, apprenants, inscriptions, sessions, évaluations, certificats et paiements dans une même plateforme.

La plateforme doit également fournir au centre une visibilité sur son activité et sa rentabilité, en distinguant clairement les revenus issus des inscriptions des coûts associés aux formations, notamment le coût fixe des formateurs.

Le projet comprend :

- une application Web ;
- une application mobile React Native construite avec Expo ;
- un backend/API ;
- une base de données MongoDB ;
- des services locaux Docker et des intégrations externes contrôlées ;
- des règles métier, rôles et données partagés entre les deux clients.

La plateforme est conçue pour **un seul centre/organisme de formation dans cette version**. Elle ne doit pas introduire de modèle multi-tenant ou multi-organisation sans exigence fonctionnelle explicite.

---

# 2. Objectifs

La plateforme doit permettre de :

1. centraliser les formations et leur contenu pédagogique ;
2. gérer deux modalités de formation fondamentalement différentes ;
3. gérer les comptes Admin, Formateur et Apprenant ;
4. permettre l'inscription publique des Apprenants ;
5. permettre à l'Admin de créer et gérer les comptes Formateurs ;
6. gérer les formations, modules, lessons et ressources ;
7. gérer les sessions uniquement lorsqu'une formation nécessite des séances planifiées ;
8. gérer les inscriptions et paiements ;
9. gérer les présences pour les formations concernées ;
10. permettre aux Formateurs de créer des évaluations ;
11. proposer une génération assistée par IA des quiz à partir du contenu réel de la formation ;
12. laisser au Formateur le contrôle final des évaluations générées ;
13. délivrer uniquement des **Certificats**, après réussite des conditions d'évaluation ;
14. suivre les revenus et les coûts afin de calculer la rentabilité ;
15. fournir des statistiques de pilotage ;
16. sécuriser les accès selon le rôle ;
17. exposer une API REST sécurisée commune aux applications Web et mobile.

---

# 3. Acteurs et rôles

La plateforme possède exactement trois rôles :

- **Admin**
- **Formateur**
- **Apprenant**

Chaque utilisateur possède un seul rôle.

## 3.1 Admin

L'Admin possède les responsabilités globales de gestion de la plateforme.

Il peut notamment :

- gérer les utilisateurs ;
- créer, modifier, désactiver et gérer les comptes Formateurs ;
- gérer les Apprenants ;
- gérer les formations ;
- gérer les modules, lessons et ressources ;
- gérer les sessions de formations en présentiel ;
- gérer les inscriptions ;
- gérer les présences ;
- consulter et gérer les paiements ;
- consulter les factures ;
- gérer les coûts des formations ;
- définir/mettre à jour le coût fixe associé aux Formateurs lorsque nécessaire ;
- superviser l'ensemble des évaluations et certificats ;
- consulter les statistiques ;
- consulter la rentabilité.

### Création des Formateurs

Il n'existe **aucune inscription publique pour les Formateurs**.

Le flux obligatoire est :

```text
Admin
  ↓
Création du compte Formateur
  ↓
Transmission sécurisée des informations d'accès
  ↓
Formateur
  ↓
Connexion
```

L'implémentation peut utiliser un mot de passe temporaire ou un mécanisme d'invitation, mais le principe métier reste le même : **seul l'Admin crée le compte Formateur**.

## 3.2 Formateur

Le Formateur peut, dans le périmètre des formations dont il est propriétaire et des sessions qui lui sont affectées :

- consulter et gérer son profil ;
- créer et gérer les formations dont il est l'unique propriétaire ;
- structurer le contenu pédagogique ;
- ajouter des modules ;
- ajouter des lessons ;
- ajouter des ressources ;
- gérer les formations en ligne self-paced ;
- gérer les sessions de formations en présentiel qui lui sont attribuées ;
- consulter les apprenants concernés ;
- enregistrer les présences des sessions autorisées ;
- créer des évaluations ;
- générer une évaluation avec l'assistance de l'IA ;
- revoir et modifier les questions générées ;
- publier/activer une évaluation ;
- consulter les résultats nécessaires à son activité.

### Propriété des formations et affectation aux sessions

Chaque Formation possède exactement un Formateur propriétaire (`ownerTrainer`).

- lorsqu'un Formateur crée une Formation, il en devient automatiquement le propriétaire ;
- lorsqu'un Admin crée une Formation, il doit désigner son Formateur propriétaire ;
- seul l'Admin peut transférer la propriété d'une Formation à un autre Formateur ;
- le propriétaire peut gérer le cycle de vie, le contenu pédagogique et les évaluations de sa Formation ;
- il n'existe pas de liste de copropriétaires ni de permissions personnalisées par Formation.

Une Session présentielle peut en revanche être affectée à un ou plusieurs Formateurs. L'Admin ou le propriétaire de la Formation peut effectuer ces affectations. Un Formateur affecté à une Session peut gérer son planning opérationnel, consulter les Apprenants concernés, enregistrer les présences et consulter les résultats nécessaires à cette Session.

L'affectation à une Session donne un accès en lecture au contenu nécessaire de la Formation, mais ne permet pas de modifier la Formation, son contenu ou ses évaluations. Le Formateur propriétaire conserve ces droits. Un Formateur indiqué sur une entrée de planning doit être affecté à la Session correspondante.

## 3.3 Apprenant

L'Apprenant peut :

- créer son propre compte via l'inscription publique ;
- se connecter ;
- gérer son profil ;
- consulter le catalogue ;
- consulter les formations ;
- consulter le contenu auquel il est autorisé à accéder ;
- s'inscrire à une formation en ligne ;
- s'inscrire à une session présentielle ;
- effectuer le paiement ;
- consulter ses paiements et factures ;
- suivre sa progression dans une formation en ligne ;
- consulter son planning pour les formations présentielles ;
- passer les évaluations disponibles ;
- consulter ses résultats ;
- télécharger ses certificats obtenus ;
- attribuer une note de satisfaction à une Formation lorsqu'il remplit les conditions d'éligibilité.

---

# 4. Authentification et création des comptes

## 4.1 Inscription publique

L'inscription publique est disponible **uniquement pour les Apprenants**.

```text
Public
  ↓
Créer un compte
  ↓
Rôle = Apprenant
```

Un utilisateur ne doit pas pouvoir sélectionner librement `Admin` ou `Formateur` sur la page publique d'inscription.

## 4.2 Compte Formateur

Un Formateur est recruté directement par le centre.

Son compte est créé par l'Admin.

Le système doit empêcher la création publique d'un compte Formateur.

L'Admin crée le Formateur avec un mot de passe temporaire transmis de manière sécurisée en dehors de la plateforme. Le Formateur doit obligatoirement remplacer ce mot de passe lors de sa première connexion avant d'accéder aux autres fonctionnalités. Aucun workflow d'invitation par email n'est requis.

## 4.3 Compte Admin

Le compte Admin initial est créé par une commande CLI/seed de déploiement idempotente utilisant `INITIAL_ADMIN_EMAIL` et `INITIAL_ADMIN_PASSWORD`. Cette commande ne crée rien lorsqu'un compte Admin existe déjà.

L'Admin initial doit remplacer son mot de passe d'initialisation lors de sa première connexion. Aucun endpoint HTTP public ne permet de créer un Admin et aucune opération d'inscription, de profil ou de gestion Formateur ne permet d'attribuer ce rôle. La création d'Admins supplémentaires est hors périmètre du MVP.

## 4.4 Authentification

La plateforme doit prévoir :

- connexion email + mot de passe ;
- JWT Bearer ;
- autorisation par rôle ;
- réinitialisation du mot de passe ;
- modification du profil ;
- mécanisme de refresh token rotatif ;
- protection des routes côté backend.

Les protections côté frontend ne remplacent jamais l'autorisation côté backend.

L'architecture d'authentification utilise :

- un JWT d'accès d'une durée par défaut de 15 minutes ;
- un refresh token aléatoire d'une durée par défaut de 7 jours ;
- rotation du refresh token après chaque utilisation ;
- stockage uniquement de l'empreinte du refresh token dans MongoDB ;
- révocation de tous les refresh tokens lors d'un changement de mot de passe ou de la désactivation du compte ;
- révocation du refresh token courant lors de la déconnexion.

Le Web conserve le JWT d'accès en mémoire et reçoit le refresh token dans un cookie `HttpOnly`, `Secure` en production et configuré avec `SameSite=Lax`. Le refresh cookie est limité au chemin `/api/auth`. Les règles de rotation et de révocation sont appliquées par le backend.

Chaque requête protégée vérifie que l'utilisateur existe toujours et que son compte est actif. La désactivation d'un compte bloque donc immédiatement l'accès backend, même si un JWT non expiré existe encore.

Les jetons de réinitialisation de mot de passe sont aléatoires, à usage unique, stockés sous forme d'empreinte et expirent après 30 minutes. Les liens sont transmis par un serveur SMTP configuré pour les environnements de développement/test.

Un mot de passe contient au minimum huit caractères. Les emails sont normalisés en minuscules avant comparaison et protégés par un index unique.

---

# 5. Types de formations

La plateforme supporte **exactement deux types de formations** :

1. **Formation en ligne self-paced**
2. **Formation en présentiel**

Ces deux types ne doivent pas être modélisés comme une seule modalité avec des comportements identiques.

Le type est obligatoire et définitivement immuable dès la création de la Formation.

---

# 6. Formation en ligne — Self-paced

Une formation en ligne est une formation autonome.

Le contenu pédagogique est préparé à l'avance par le Formateur et mis à disposition dans la plateforme.

Il n'est pas nécessaire de planifier des séances physiques ou des réunions en temps réel.

## 6.1 Structure

La structure obligatoire est :

```text
Formation
└── Modules
    └── Lessons
        └── Resources
```

Une formation en brouillon peut contenir zéro ou plusieurs modules.

Un module peut contenir plusieurs lessons.

Une lesson peut contenir plusieurs ressources.

## 6.2 Ressources

Une lesson peut contenir notamment :

- texte pédagogique ;
- PDF ;
- document ;
- présentation ;
- image ;
- fichier d'exercice ;
- autre fichier pédagogique ;
- URL externe ;
- lien vidéo ;
- autre ressource externe pertinente.

Le système doit distinguer au minimum :

```text
FILE
└── référence vers un fichier stocké

EXTERNAL_URL
└── URL externe
```

La plateforme ne devient pas un système propriétaire de streaming vidéo.

## 6.3 Progression

Pour une formation self-paced, le système doit pouvoir suivre la progression de l'Apprenant dans le contenu.

La progression appartient à l'inscription self-paced (`Enrollment`) et non directement au couple global Apprenant + Formation. Il ne peut exister qu'un enregistrement de progression de lesson pour une même combinaison `Enrollment + Lesson`.

Le modèle de progression peut notamment permettre de savoir :

- quelles lessons ont été consultées/complétées ;
- quelles ressources ont été consultées lorsque ce suivi est pertinent ;
- le pourcentage de progression ;
- l'état global de progression de la formation.

Une Formation self-paced est considérée comme terminée lorsque 100 % de ses lessons ont été explicitement marquées comme terminées par l'Apprenant. La consultation des ressources peut être suivie à titre informatif, mais elle ne constitue pas une condition indépendante de complétion ou de certification.

Le pourcentage est calculé à partir du nombre de lessons terminées et ne peut pas être modifié directement. Une progression de lesson conserve au minimum son état terminé et sa date de complétion.

L'Apprenant peut marquer ou démarquer une lesson avant l'émission du Certificat. Après émission, les progressions ayant servi à établir l'éligibilité deviennent immuables.

Lorsqu'une nouvelle lesson est ajoutée à une Formation publiée, elle entre dans le calcul des inscriptions actives qui ne possèdent pas encore de Certificat. Les Certificats déjà délivrés et leur historique d'éligibilité ne sont pas modifiés.

## 6.4 Inscription

L'Apprenant s'inscrit à la **Formation**, et non à une session physique.

```text
Apprenant
  ↓
Formation en ligne
  ↓
Stripe Checkout
  ↓
Paiement confirmé par le webhook backend
  ↓
Création de l'inscription active
  ↓
Accès au contenu
  ↓
Progression
  ↓
Évaluation
  ↓
Certificat si réussite
```

---

# 7. Formation en présentiel

Une formation présentielle est organisée autour de séances planifiées.

La distinction fondamentale est :

```text
Formation = programme pédagogique réutilisable
Session   = occurrence planifiée de cette formation
```

L'Apprenant s'inscrit à une **Session**.

## 7.1 Informations d'une session

Une session peut contenir :

- formation ;
- date de début ;
- date de fin ;
- capacité ;
- statut ;
- formateur(s) affecté(s) ;
- planning ;
- lieu ;
- adresse ;
- salle ;
- informations complémentaires.

## 7.2 Planning

Une Session contient une ou plusieurs entrées de planning (`SessionSchedule`). Chaque entrée représente une occurrence planifiée avec sa propre date et ses propres heures de début et de fin.

Les entrées d'une même Session peuvent être réparties sur plusieurs dates calendaires. Par exemple, une Session organisée sur dix dates possède dix entrées de planning. Il ne faut pas créer dix Sessions distinctes pour représenter ces dix dates.

La timezone métier unique de la plateforme est la timezone IANA `Africa/Tunis`. Le Web affiche et saisit les horaires dans cette timezone. Le backend convertit les horaires en instants UTC pour le stockage et les comparaisons. Les timestamps échangés par l'API utilisent le format ISO 8601 avec un offset explicite ou le suffixe `Z`.

Une entrée peut contenir :

- date ;
- heure de début ;
- heure de fin ;
- module associé si pertinent ;
- lesson associée si pertinent ;
- formateur ;
- lieu ;
- salle.

Pour chaque entrée, l'instant de début doit être strictement antérieur à l'instant de fin. Les dates de début et de fin de la Session sont dérivées respectivement de la première et de la dernière entrée de planning.

Deux entrées se chevauchent lorsque :

```text
première.startAt < seconde.endAt
ET
seconde.startAt < première.endAt
```

Deux entrées adjacentes, dont l'une commence exactement lorsque l'autre se termine, sont autorisées.

Le backend doit refuser, parmi les Sessions non annulées :

- le chevauchement de deux entrées affectées au même Formateur ;
- le chevauchement de deux entrées utilisant la même combinaison normalisée lieu + salle.

Le contrôle de conflit de salle ne s'applique pas lorsqu'aucune salle n'est renseignée. Des entrées parallèles restent permises lorsqu'elles utilisent des Formateurs et des salles différents. Les Sessions annulées ne participent pas aux contrôles de conflit.

Lorsqu'un module ou une lesson est associé à une entrée de planning, il doit appartenir à la Formation parente de la Session.

Le système ne détecte pas les conflits d'emploi du temps personnels des Apprenants et n'introduit pas de timezone par utilisateur ou par Session.

## 7.3 Statuts de session

Les statuts peuvent être :

- Planifiée ;
- En cours ;
- Terminée ;
- Annulée.

Une Session ne peut passer au statut Annulée que si elle ne possède aucune inscription. Dès qu'une inscription existe, l'annulation de la Session est interdite dans le périmètre actuel.

## 7.4 Inscription

Le flux est :

```text
Apprenant
  ↓
Formation présentielle
  ↓
Choix d'une session
  ↓
Stripe Checkout
  ↓
Paiement confirmé par le webhook backend
  ↓
Création de l'inscription active
  ↓
Participation aux séances
  ↓
Évaluation
  ↓
Certificat si réussite
```

---

# 8. Formation, contenu et session : séparation obligatoire

Les concepts suivants ne doivent pas être confondus :

| Concept | Rôle |
|---|---|
| Formation | Programme pédagogique réutilisable |
| Module | Grande partie logique d'une formation |
| Lesson | Unité pédagogique d'un module |
| Resource | Support pédagogique d'une lesson |
| Session | Occurrence planifiée d'une formation présentielle |
| Enrollment | Inscription d'un Apprenant à une formation ou session selon le type |
| Attendance | Présence d'un Apprenant à une session présentielle |
| Progress | Avancement d'un Apprenant dans une formation self-paced |

Règle importante :

- une formation self-paced n'a pas besoin de Session ;
- une formation présentielle utilise des Sessions ;
- le contenu pédagogique appartient à la Formation ;
- les présences appartiennent aux Sessions.

---

# 9. Gestion des formations

Une Formation possède notamment :

- titre ;
- Formateur propriétaire unique ;
- description ;
- catégorie ;
- niveau ;
- prix strictement positif en euro (`EUR`) ;
- durée ;
- objectifs ;
- prérequis ;
- programme ;
- image ;
- type de formation ;
- statut ;
- modules ;
- contenu pédagogique ;
- règles d'évaluation/certification applicables ;
- pour une Formation présentielle, pourcentage minimal de présence requis pour la certification, avec une valeur par défaut de 80 %.

## 9.1 Types

Le type doit être explicitement l'un des deux :

```text
SELF_PACED_ONLINE
IN_PERSON
```

Le type ne peut être modifié après la création, y compris lorsque la Formation n'est pas encore publiée ou lorsqu'elle est archivée. Une erreur de modalité impose de créer une nouvelle Formation avec le type correct. Aucun workflow de conversion ou de migration entre les deux modalités n'est prévu.

## 9.2 Cycle de vie

Une formation peut être :

- créée ;
- modifiée ;
- publiée ;
- archivée.

L'archivage ne doit pas détruire l'historique des inscriptions, paiements, évaluations, progressions ou certificats.

Une Formation self-paced ne peut être publiée que si elle contient au moins un module contenant au moins une lesson. Une Formation présentielle peut être publiée sans Session, mais aucun Checkout ne peut être créé tant qu'elle ne possède pas de Session planifiée disponible.

## 9.3 Suppression et préservation de l'historique

La suppression définitive est réservée aux éléments non utilisés qui ne possèdent aucun historique métier :

- une Formation en brouillon peut être supprimée uniquement si elle ne possède aucune Session, inscription, paiement ou tentative d'Évaluation ;
- une Session peut être annulée uniquement si elle ne possède aucune inscription ; elle peut être supprimée définitivement uniquement si elle ne possède aucune inscription ni aucun paiement ;
- une Évaluation en brouillon peut être supprimée ; une Évaluation publiée doit être archivée ;
- un module, une lesson ou une ressource peut être supprimé tant qu'aucune progression d'Apprenant ne le référence ; sinon il doit être archivé ;
- un utilisateur sans historique métier peut être supprimé ; sinon son compte doit être désactivé.

Les paiements, Factures, Certificats, tentatives d'Évaluation soumises, présences et progressions terminées ne sont jamais supprimés définitivement.

Une opération `DELETE` interdite par ces règles doit retourner une erreur de conflit et ne doit jamais effectuer de suppression en cascade. Un fichier local n'est supprimé que lorsque sa ressource est supprimée définitivement et qu'aucun autre enregistrement ne le référence.

---

# 10. Modules, lessons et ressources

## 10.1 Module

Un module représente une partie logique du programme.

Il possède notamment :

- titre ;
- description ;
- ordre ;
- statut éventuel.

Il peut être créé, modifié, réordonné et archivé selon les règles métier.

## 10.2 Lesson

Une lesson possède notamment :

- titre ;
- description ;
- ordre ;
- contenu textuel ;
- ressources ;
- liens ;
- instructions.

## 10.3 Resource

Une ressource possède notamment :

- titre ;
- type ;
- description ;
- ordre ;
- référence de fichier ou URL ;
- visibilité ;
- métadonnées nécessaires.

Les ressources doivent être accessibles uniquement aux utilisateurs autorisés.

---

# 11. Évaluations et quiz

Les Évaluations permettent l'évaluation pédagogique et, lorsqu'elles sont désignées comme telles, la certification de l'Apprenant. Le Feedback de satisfaction est un concept séparé décrit dans une section dédiée.

## 11.1 Création par le Formateur

Les évaluations/quiz sont créés et gérés par le **Formateur**.

Dans le modèle de propriété retenu, il s'agit du Formateur propriétaire de la Formation concernée. Un Formateur uniquement affecté à une Session ne peut pas modifier les évaluations de la Formation.

L'Admin peut consulter et archiver toutes les Évaluations à des fins de supervision. La création et la modification du contenu des questions restent sous la responsabilité du Formateur propriétaire de la Formation.

## 11.2 Génération assistée par IA

Le Formateur doit disposer d'une option de génération assistée par IA.

La génération doit pouvoir utiliser comme contexte le matériel réel de la formation, notamment :

- modules ;
- lessons ;
- texte du cours ;
- PDFs ;
- documents ;
- ressources pédagogiques pertinentes.

Les fichiers pédagogiques sont stockés sur le système de fichiers persistant du backend. Lors d'une demande de génération, le backend construit le contexte à partir du texte des modules et lessons puis extrait à la demande le texte des ressources compatibles de la Formation concernée.

Les formats extractibles dans le périmètre actuel sont :

- PDF contenant du texte ;
- DOCX ;
- PPTX ;
- TXT.

Les images, PDF scannés, anciens formats DOC/PPT, archives et autres fichiers binaires restent téléchargeables comme ressources, mais ne contribuent pas au contexte IA. Aucun OCR n'est prévu. Les ressources `EXTERNAL_URL` ne sont ni explorées ni téléchargées automatiquement par le backend.

Si une ressource ne peut pas être extraite, la génération peut continuer avec les autres contenus disponibles. Si aucun contenu textuel exploitable n'existe pour la Formation, le backend refuse la génération avec une erreur explicite.

Seul le contenu pédagogique de la Formation sélectionnée est transmis au fournisseur IA. Les données des Apprenants, présences, paiements et autres Formations ne doivent pas être incluses. La réponse IA doit respecter le schéma structuré des types de questions autorisés avant d'être enregistrée dans une Évaluation `DRAFT`.

Le principe est :

```text
Contenu réel de la formation
        ↓
Génération IA
        ↓
Questions proposées
        ↓
Révision par le Formateur
        ↓
Modification / suppression / ajout
        ↓
Validation par le Formateur
        ↓
Évaluation publiée
```

L'IA est un **assistant**.

Elle ne décide pas seule de l'évaluation finale.

Le Formateur doit pouvoir :

- consulter les questions générées ;
- modifier les questions ;
- supprimer des questions ;
- ajouter des questions ;
- modifier les réponses proposées ;
- définir les bonnes réponses ;
- ajuster les points ;
- valider l'évaluation ;
- publier ou activer l'évaluation.

## 11.3 Questions

Une question peut notamment contenir :

- énoncé ;
- type ;
- choix de réponses si nécessaire ;
- bonne réponse/réponses ;
- explication éventuelle ;
- nombre de points ;
- ordre.

Les types de questions pris en charge dans le périmètre actuel sont :

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
TRUE_FALSE
```

Toutes les questions sont corrigées automatiquement par le backend. Une question attribue soit la totalité de ses points, soit zéro point. Pour une question `MULTIPLE_CHOICE`, la réponse doit correspondre exactement à l'ensemble des bonnes réponses ; aucun crédit partiel n'est attribué.

Le système doit conserver la version finale validée par le Formateur.

## 11.4 Cycle de vie de l'Évaluation

Le cycle de vie est :

```text
DRAFT → PUBLISHED → ARCHIVED
```

- seule une Évaluation `DRAFT` peut être modifiée ;
- la publication exige au moins une question valide, un total de points positif, un seuil de réussite compris entre 1 et 100, et un nombre maximal de tentatives strictement positif ;
- après publication, les questions, réponses, points, seuil de réussite, nombre maximal de tentatives et durée ne sont plus modifiables ;
- l'archivage empêche toute nouvelle tentative sans modifier les tentatives et résultats existants ;
- une Évaluation désignée comme certifiante ne peut pas être archivée tant qu'elle conserve cette désignation.

## 11.5 Évaluation certifiante

Une Formation peut désigner au maximum une Évaluation publiée comme Évaluation certifiante obligatoire.

- si aucune Évaluation certifiante n'est désignée, la complétion de la Formation selon sa modalité suffit pour l'éligibilité au Certificat ;
- si une Évaluation certifiante est désignée, l'Apprenant doit disposer d'au moins une tentative réussie à cette Évaluation ;
- un Formateur affecté uniquement à une Session ne peut pas désigner ou modifier l'Évaluation certifiante de la Formation.

## 11.6 Passage de l'évaluation

L'Apprenant doit pouvoir passer une évaluation qui lui est accessible.

Seul un Apprenant disposant d'une inscription active peut commencer une tentative sur une Évaluation `PUBLISHED` de la Formation concernée.

Le Formateur propriétaire définit pour chaque Évaluation :

- le seuil de réussite en pourcentage ;
- le nombre maximal de tentatives, avec une valeur par défaut de trois ;
- une durée optionnelle exprimée en minutes ; l'absence de durée signifie que l'Évaluation n'est pas chronométrée.

Le score en pourcentage correspond au total des points obtenus divisé par le total des points disponibles. Le backend calcule le score et détermine le résultat de la tentative.

Le cycle de vie d'une tentative est :

```text
IN_PROGRESS → PASSED
            → FAILED
```

Une tentative est comptabilisée lorsqu'elle est soumise ou lorsque sa durée configurée expire. Le score et le résultat réussite/échec sont présentés immédiatement à l'Apprenant. Les bonnes réponses et explications ne deviennent visibles qu'après une tentative réussie ou après utilisation de la dernière tentative autorisée.

Le système doit enregistrer :

- l'évaluation ;
- l'Apprenant ;
- les réponses ;
- le score ;
- la date ;
- le statut ;
- les informations nécessaires à la certification.

Les tentatives soumises ou expirées sont immuables et restent disponibles dans l'historique, y compris après archivage de l'Évaluation.

## 11.7 Feedback de satisfaction

Après avoir terminé une Formation selon les règles de sa modalité, l'Apprenant peut attribuer une note de satisfaction entière de 1 à 5 étoiles.

Lorsque la Formation possède une Évaluation certifiante, l'Apprenant doit également avoir réussi cette Évaluation. Lorsqu'aucune Évaluation certifiante n'est configurée, la complétion de la Formation suffit.

Le Feedback respecte les règles suivantes :

- il appartient à une inscription et à sa Formation ;
- il ne peut exister qu'un seul Feedback par inscription ;
- la note est un entier compris entre 1 et 5 ;
- le backend recalcule l'éligibilité avant d'accepter le Feedback ;
- le Feedback devient immuable après sa création ;
- aucun commentaire textuel n'est prévu ;
- aucun affichage public ou système de modération des Feedbacks n'est prévu ;
- les notes individuelles de Feedback ne sont pas utilisées par le moteur de recommandation et ne sont jamais exposées aux Apprenants.

Le dashboard Admin utilise les Feedbacks pour présenter au minimum le nombre de notes, la moyenne et la distribution des notes de 1 à 5, globalement et par Formation.

---

# 12. Assistance IA au contenu et orientation publique

## 12.1 Tuteur IA de la formation

Le tuteur IA est une fonctionnalité distincte de la génération de questions d'évaluation. Il est affiché dans l'espace de lecture `/app/content/:trainingId` uniquement lorsque le contenu est consulté avec l'accès `LEARNER_READ`.

L'endpoint `POST /api/trainings/:id/tutor/messages` exige :

- un Apprenant authentifié ;
- un changement de mot de passe effectué lorsque celui-ci est requis ;
- une inscription à la formation demandée.

Le tuteur peut répondre à une question de cours, simplifier une notion, donner un exemple fondé sur le cours, créer de courtes questions d'entraînement, résumer ou proposer une aide à la révision. Il ne doit utiliser que le contenu autorisé de la formation.

Le backend classe les leçons actives et non archivées à partir de la question, de la conversation et de la leçon courante. Il récupère au plus cinq leçons et plafonne le contexte au minimum de `AI_MAX_CONTEXT_CHARS` et de 24 000 caractères. Gemini reçoit seulement le message, au plus huit éléments récents de conversation et les extraits de leçons sélectionnés. Il ne reçoit ni identité, ni paiement, ni progression, ni certificat, ni résultat d'évaluation.

La réponse doit respecter un schéma JSON et renvoyer uniquement des identifiants de leçons présents dans le contexte autorisé. Une réponse fondée exige au moins une citation; les citations inventées, non autorisées ou incohérentes sont rejetées. En l'absence de source suffisante, la réponse est marquée non fondée et ne contient aucune citation. L'interface affiche des liens cliquables vers les leçons citées.

Les messages sont limités à 2 000 caractères. L'historique existe dans l'interface ouverte et n'est pas persisté par le serveur. La route est limitée en mémoire à 30 requêtes par adresse IP et par fenêtre de 15 minutes. Le fournisseur utilise d'abord `gemini-3.1-flash-lite`, applique un délai maximal de 15 secondes et limite la sortie à 1 600 jetons; le modèle configuré peut servir de repli lors de certaines erreurs transitoires.

## 12.2 Concierge IA public

Le concierge est un assistant public distinct du tuteur. Il apparaît comme un widget flottant en bas à droite pour les visiteurs déconnectés et disparaît après connexion. Il affiche un message d'accueil, des questions suggérées, des sources publiques et des actions cliquables, ainsi qu'un avertissement sur le traitement Gemini et les informations sensibles à ne pas partager.

La route anonyme est `POST /api/public/concierge/messages`. Elle ne consulte que :

- des pages publiques sélectionnées (accueil, catalogue, inscription, paiement, déroulement, à propos et contact) ;
- les champs autorisés des formations `PUBLISHED`, avec une limite de lecture de 100 formations.

Le concierge ne possède aucun accès aux utilisateurs, inscriptions, paiements, progression, leçons, évaluations, certificats, identifiants ou contenus privés. Il sélectionne jusqu'à cinq pages et cinq formations pertinentes, puis envoie au plus huit sources et 12 000 caractères au fournisseur.

Les citations et actions doivent référencer les identifiants de sources reçus. Le serveur résout les URL à partir de cette liste : Gemini ne peut donc pas créer de lien protégé ou externe. Les messages, la conversation et les sources sont explicitement traités comme des données non fiables afin d'ignorer les tentatives d'injection. Si le contexte public ne suffit pas, le concierge répond prudemment et propose l'action Contact.

Le message est limité à 1 000 caractères et la conversation à quatre messages de 1 000 caractères. La réponse comporte au plus cinq citations, trois actions, trois suggestions et 3 000 caractères. Un champ caché `website` sert de honeypot et évite un appel Gemini lorsqu'il est rempli. La route est limitée en mémoire à 10 requêtes par adresse IP sur 15 minutes, ne conserve aucun historique serveur, applique un délai de 15 secondes et une sortie maximale de 1 200 jetons.

# 13. Certificats

Le système utilise **uniquement des Certificats**.

Il n'existe **aucune fonctionnalité d'Attestation** dans le périmètre actuel.

Les termes `Attestation`, `Attestation PDF` et les fonctionnalités associées ne doivent pas apparaître dans l'implémentation finale.

## 13.1 Condition d'obtention

Un certificat est généré uniquement lorsque l'Apprenant satisfait toutes les conditions d'éligibilité applicables.

Conditions communes :

- l'Apprenant possède une inscription active à la Formation ou à la Session concernée ;
- la Formation est terminée selon les règles de sa modalité ;
- l'Évaluation certifiante est réussie lorsqu'une telle Évaluation est désignée pour la Formation.

Pour une Formation self-paced, la complétion exige que 100 % des lessons soient explicitement marquées comme terminées. La consultation des ressources peut contribuer aux informations de progression, mais ne bloque pas séparément l'éligibilité.

Pour une Formation en présentiel, la complétion exige que la Session possède le statut Terminée et que l'Apprenant satisfasse la règle de présence définie pour la certification.

Principe :

```text
Formation terminée selon les règles
        +
Évaluation requise réussie
        ↓
Éligibilité
        ↓
Certificat
```

Le backend doit être la source de vérité de l'éligibilité.

La génération du Certificat est effectuée à la demande par une opération backend idempotente. Le backend recalcule systématiquement l'éligibilité avant la génération. L'Admin ne peut pas contourner ou forcer manuellement une éligibilité non satisfaite.

Une inscription peut produire au maximum un Certificat. Une nouvelle demande de génération retourne le Certificat existant. Si le fichier PDF doit être recréé pour une raison technique, il est régénéré à partir du même enregistrement sans créer un nouveau Certificat ni un nouveau numéro.

## 13.2 Contenu du certificat

Le certificat doit notamment contenir :

- nom et prénom de l'Apprenant ;
- nom de la Formation ;
- dates pertinentes ;
- durée ;
- numéro unique ;
- date d'émission ;
- identité du centre ;
- informations nécessaires à l'identification du centre.

Le design final du certificat sera défini pendant la conception UI/document.

## 13.3 Historique

La suppression ou l'archivage d'une formation ne doit pas supprimer les certificats déjà délivrés.

---

# 14. Inscriptions

Le modèle d'inscription dépend du type de formation.

Une `Enrollment` représente une inscription valide donnant accès à la formation ou à la session concernée. Elle est créée par le backend uniquement après confirmation d'un paiement réussi par le webhook Stripe.

Le système n'introduit pas d'état `PENDING_PAYMENT` dans `Enrollment`. Un paiement en attente, échoué ou annulé ne crée pas d'inscription et ne donne aucun accès. Les détails de traitement du paiement restent portés par `Payment` et ne sont pas recopiés dans le cycle de vie de `Enrollment`.

### Self-paced

```text
Enrollment → Learner + Formation
```

### Présentiel

```text
Enrollment → Learner + Session
```

Règles :

1. un Apprenant ne peut pas avoir deux inscriptions équivalentes ; pour le self-paced, l'équivalence correspond au même Apprenant et à la même Formation ; pour le présentiel, elle correspond au même Apprenant et à la même Session ;
2. une session présentielle ne peut pas dépasser sa capacité ; le backend vérifie la disponibilité avant de créer le Checkout puis applique de manière atomique la limite de capacité lors de la création de l'inscription après paiement confirmé ;
3. une session annulée ne peut pas recevoir de nouvelles inscriptions ;
4. une Session ne peut être annulée que si elle ne possède aucune inscription ;
5. une inscription créée après paiement réussi est permanente dans le périmètre actuel et ne possède aucun workflow ou statut d'annulation ;
6. l'accès au contenu doit être vérifié côté backend à partir de l'inscription ;
7. aucune entité de réservation temporaire de place n'est introduite dans le périmètre actuel.

Un Apprenant peut s'inscrire à des Sessions différentes d'une même Formation présentielle. Il ne peut pas se réinscrire à la même Formation self-paced ou à la même Session tant que l'inscription correspondante existe.

---

# 15. Présences

Les présences concernent les formations présentielles.

Une présence est enregistrée pour une inscription active et une entrée de planning (`SessionSchedule`) déterminée. Il ne peut exister qu'un seul enregistrement de présence pour une même combinaison `Enrollment + SessionSchedule`.

L'Admin et les Formateurs affectés à la Session peuvent enregistrer les présences pendant que la Session est Planifiée ou En cours.

Les seuls statuts de présence sont :

```text
PRESENT
ABSENT
```

Il n'existe pas de statut `LATE`, `EXCUSED_ABSENCE`, « Retard » ou « Absence justifiée » dans le périmètre.

Une absence d'enregistrement signifie que la présence n'a pas encore été saisie ; elle ne doit pas être interprétée automatiquement comme `ABSENT`.

Le pourcentage de présence est calculé par entrée de planning :

```text
pourcentage de présence =
nombre de PRESENT
÷ nombre total d'entrées de planning de la Session
× 100
```

`PRESENT` compte comme une présence complète. `ABSENT` ne compte pas comme une présence. Aucun calcul pondéré par la durée et aucun crédit partiel ne sont appliqués.

Chaque Formation présentielle définit un pourcentage minimal de présence compris entre 1 et 100, avec une valeur par défaut de 80 %. L'Apprenant satisfait la règle de présence pour la certification lorsque son pourcentage est supérieur ou égal à ce seuil.

Une Session ne peut pas passer au statut Terminée tant que chaque inscription active ne possède pas un statut de présence pour chaque entrée de planning. Lorsque la Session devient Terminée, ses enregistrements de présence deviennent immuables.

La plateforme ne doit pas prétendre détecter automatiquement la présence via un service externe.

---

# 16. Paiements

## 16.1 Principe

Les revenus du centre proviennent des **paiements d'inscription des Apprenants**.

Un `Payment` enregistre la tentative ou la transaction Stripe d'un Apprenant pour une Formation ou une Session déterminée.

Lorsqu'un paiement est confirmé comme réussi, le backend crée l'inscription active correspondante et l'associe au paiement. Un paiement en attente, échoué ou annulé peut être conservé pour la traçabilité technique, mais il ne crée pas d'inscription et ne donne aucun accès.

Chaque tentative Stripe correspond à un seul `Payment`. Un `Payment` réussi crée exactement une `Enrollment` et chaque `Enrollment` référence exactement le `Payment` réussi qui l'a créée. Les événements webhook répétés doivent réutiliser la même inscription.

Il n'existe pas de concept métier séparé appelé **« Impayé »**.

Le fait qu'un paiement soit en attente ou échoué doit être représenté par son statut de paiement, pas par une entité ou un état métier supplémentaire « Impayé ».

## 16.2 Statuts

Les statuts de paiement sont exactement :

- `PENDING`
- `PAID`
- `FAILED`
- `CANCELLED`

`CANCELLED` représente uniquement une tentative Stripe Checkout annulée avant paiement. Aucun statut ou workflow de remboursement n'est prévu dans le périmètre actuel. Aucun statut ne doit introduire un concept séparé « Unpaid/Impayé ».

Ces statuts appartiennent exclusivement à `Payment`. Ils ne doivent pas être reproduits sous forme d'états de paiement dans `Enrollment`.

## 16.3 Stripe

Le paiement en ligne doit utiliser **Stripe en mode test/développement** pendant l'implémentation.

Aucun paiement réel ne doit être traité pendant le développement.

La devise `EUR` est utilisée pour les paiements de test. La disponibilité future d'un compte Stripe de production pour une entité établie en Tunisie ne fait pas partie des garanties de cette version et devra être vérifiée auprès de Stripe avant tout passage en production.

Architecture cible :

```text
Frontend
   ↓
Demande de Stripe Checkout
   ↓
Vérification backend du prix et de la disponibilité
   ↓
Stripe
   ↓
Backend Webhook
   ↓
Vérification de l'événement
   ↓
Mise à jour du Payment
   ↓
Création atomique de l'Enrollment après paiement réussi
   ↓
Accès selon les règles
```

Le webhook backend est la **source de vérité pour confirmer qu'un paiement Stripe a réellement réussi**.

Le frontend ne doit jamais être considéré comme la preuve suffisante d'un paiement réussi.

Il n'existe ni `Enrollment` en attente de paiement ni entité `SeatReservation`. Pour une session présentielle, la création de l'inscription après paiement confirmé doit appliquer la capacité comme une contrainte atomique afin que la capacité ne soit jamais dépassée.

## 16.4 Sécurité du paiement

Le backend doit :

- vérifier les signatures des webhooks Stripe ;
- traiter les événements de manière idempotente ;
- éviter de faire confiance aux montants envoyés directement par le client ;
- associer le paiement au bon Apprenant et à la bonne Formation ou Session ;
- créer au plus une inscription pour un paiement réussi ;
- conserver les références Stripe nécessaires à la traçabilité ;
- ne jamais stocker les données de carte bancaire sensibles.

## 16.5 Factures

La plateforme utilise une seule devise : le euro, code ISO 4217 `EUR`. Les requêtes Stripe utilisent le code `eur`.

Pour rester compatible avec le traitement des paiements Stripe, les montants payables utilisent une précision de `0,01 EUR` et sont stockés sous forme d'entiers dans l'unité mineure attendue par Stripe. Aucun montant monétaire n'est stocké ou calculé avec un type flottant.

Le backend lit le prix de référence de la Formation lors de la création du Checkout. Le frontend ne fournit jamais le montant faisant autorité. Le `Payment` conserve un instantané du montant, de la devise, du titre de la Formation et, si applicable, de la Session ciblée.

Après confirmation d'un paiement réussi, le backend génère automatiquement et de manière idempotente une Facture unique associée à ce paiement.

Un paiement échoué ou annulé ne crée aucune Facture. Les événements webhook répétés doivent réutiliser la Facture existante.

Elle contient notamment :

- numéro unique ;
- identité de l'Apprenant au moment de l'émission ;
- identité du centre au moment de l'émission ;
- date d'émission ;
- une ligne correspondant à l'inscription achetée ;
- description, montant et devise de la ligne ;
- sous-total ;
- total ;
- référence du paiement.

La plateforme ne calcule aucune taxe dans le périmètre actuel. Le sous-total et le total de la Facture sont identiques et aucune ligne de taxe n'est affichée.

Les informations de la Facture constituent un instantané immuable : une modification ultérieure de la Formation, de son prix, de l'Apprenant ou de l'identité courante du centre ne modifie pas une Facture déjà émise.

Le backend de la plateforme génère le document PDF. La Facture doit pouvoir être consultée et téléchargée uniquement par un utilisateur autorisé.

---

# 17. Modèle financier et rentabilité

Le système doit distinguer :

```text
REVENUS
├── Paiements d'inscription des Apprenants
│
COÛTS
├── Coût fixe / salaire du Formateur
└── Autres coûts explicitement enregistrés
│
RÉSULTAT / RENTABILITÉ
```

## 17.1 Coût Formateur

Le centre emploie ses Formateurs et leur verse un coût fixe/salaire.

Le système représente ce coût par un `TrainerCost` mensuel explicitement saisi par l'Admin pour un Formateur et un mois calendaire déterminé.

Un `TrainerCost` contient au minimum :

- le Formateur ;
- l'année ;
- le mois ;
- le montant ;
- une note optionnelle.

Il ne peut exister qu'un seul `TrainerCost` pour une même combinaison Formateur + année + mois. L'Admin peut créer ou mettre à jour cette valeur.

Le système ne doit pas inventer un coût.

Le montant doit être explicitement renseigné. Le système ne génère pas automatiquement de salaire, ne le répartit pas entre les Formations et ne le calcule pas à partir du propriétaire d'une Formation, des heures, des Sessions, des inscriptions ou des revenus.

## 17.2 Autres coûts

Le système peut prévoir d'autres coûts de formation lorsqu'ils sont explicitement ajoutés, par exemple :

- salle ;
- matériel ;
- autres dépenses directement associées.

Ils ne doivent pas être créés automatiquement sans donnée source.

Un `TrainingCost` contient au minimum la Formation concernée, une date, un montant et une catégorie ou un libellé. Il peut référencer une Session lorsque la dépense concerne spécifiquement cette Session.

## 17.3 Rentabilité

Le dashboard doit au minimum distinguer :

- revenus ;
- coûts ;
- résultat/marge ;
- indicateur de rentabilité.

Les calculs de salaire du dashboard utilisent des mois calendaires complets. Pour une période sélectionnée, le résultat global est calculé ainsi :

```text
résultat global =
revenus confirmés
- TrainerCost enregistrés pour les mois sélectionnés
- TrainingCost explicitement enregistrés sur la période
```

L'indicateur de rentabilité est calculé ainsi :

```text
rentabilité (%) = résultat global ÷ revenus confirmés × 100
```

Lorsque les revenus confirmés sont égaux à zéro, le pourcentage de rentabilité vaut `null` ; il ne doit pas être présenté comme zéro ou comme une valeur infinie.

Aucun salaire de Formateur n'est automatiquement attribué à une Formation. Une vue par Formation peut présenter ses revenus, ses `TrainingCost` explicites et un résultat avant coûts fixes des Formateurs, mais elle ne doit pas présenter cette valeur comme la rentabilité complète de la Formation.

---

# 18. Tableau de bord, recommandations et Analytics

Le dashboard Admin doit fournir des indicateurs tels que :

- nombre de formations ;
- nombre de sessions ;
- nombre d'Apprenants ;
- nombre de Formateurs ;
- inscriptions ;
- taux de participation ;
- progression des formations en ligne ;
- tendance mensuelle des complétions self-paced ;
- Apprenants ayant une formation self-paced non terminée et aucune activité pédagogique depuis au moins 30 jours ;
- résultats/satisfaction ;
- revenus ;
- coûts ;
- résultat ;
- rentabilité.

Les indicateurs financiers doivent être calculés uniquement à partir des données enregistrées.

Il ne faut jamais inventer de revenus ou de coûts.

Le dashboard Apprenant présente au maximum trois Formations publiées auxquelles l'Apprenant n'est pas déjà inscrit. La première version du classement est explicable et déterministe : continuité avec les catégories de l'historique d'inscription, puis popularité par nombre d'inscriptions et récence. Chaque recommandation affiche sa raison. Les règles d'accès, de paiement, de prérequis et d'inscription restent entièrement validées par le backend.

L'inactivité du dashboard Admin désigne uniquement l'absence d'activité pédagogique sur une inscription self-paced non terminée. La dernière activité correspond à la date la plus récente entre l'inscription et la mise à jour d'une progression de lesson. Elle ne représente pas la dernière connexion globale de l'utilisateur.

## 18.1 Recommandations Apprenant

Le tableau de bord Apprenant affiche au plus trois formations publiées auxquelles l'Apprenant n'est pas déjà inscrit. Le classement est explicable et déterministe : continuité avec les catégories de l'historique d'inscription, puis popularité et récence. Une recommandation ne modifie jamais les règles d'accès, de paiement ou d'inscription du backend.

## 18.2 Firebase Analytics

Firebase est utilisé uniquement pour Firebase Analytics / Google Analytics. Il n'y a pas d'usage de Firebase Authentication, Firestore, Realtime Database, Storage ou Hosting.

L'initialisation nécessite simultanément `VITE_FIREBASE_ANALYTICS_ENABLED=true`, une configuration Firebase complète (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`), un navigateur compatible et le consentement explicite du visiteur. Le consentement `granted` ou `denied` est conservé sous la clé locale `analytics-consent`. Sans consentement, le SDK n'est pas initialisé et aucun événement n'est transmis.

Les événements mis en œuvre sont :

| Événement | Déclencheur | Paramètres |
| --- | --- | --- |
| `page_view` | Chaque route côté client après consentement | `page_location`, `page_path`, `page_title` |
| `recommendation_impression` | Première impression d'une recommandation | `training_id`, `training_category`, `recommendation_rank` |
| `recommendation_click` | Ouverture d'une recommandation | `training_id`, `training_category`, `recommendation_rank` |
| `recommendation_enrollment` | Inscription confirmée par le backend et attribuée à une recommandation cliquée dans la même session, au plus sept jours auparavant | `training_id`, `training_category`, `recommendation_rank` |

L'attribution est conservée en session navigateur et supprimée après conversion. Les événements ne contiennent ni nom, ni e-mail, ni identifiant utilisateur, ni montant de paiement, ni réponses ou résultats d'évaluation. `VITE_FIREBASE_ANALYTICS_DEBUG=true` ajoute `debug_mode` afin de valider les événements dans Firebase Analytics DebugView.

---

# 19. Gestion des utilisateurs

L'Admin peut :

- créer un Formateur ;
- modifier un Formateur ;
- désactiver un Formateur ;
- gérer les Apprenants ;
- consulter les historiques pertinents.

Le Formateur ne crée pas librement des comptes Formateurs.

L'Apprenant crée son propre compte via l'inscription publique.

---

# 20. Paramètres et périmètre organisationnel

La plateforme est destinée à être utilisée par un centre de formation, mais le modèle conceptuel doit rester simple.

Ne pas introduire de manière générique ou spéculative :

- `Tenant` ;
- `OrganizationMembership` ;
- multi-tenant ;
- multi-organisation ;
- `SiteSettings` ;
- `CompanySettings` ;
- autres couches de configuration statique uniquement destinées au branding ou à une architecture SaaS future.

Si une information du centre est strictement nécessaire pour un besoin concret, elle doit être modélisée uniquement à partir de ce besoin fonctionnel explicite.

L'identité nécessaire aux Certificats et Factures est fournie par la configuration de déploiement :

```text
CENTER_NAME
CENTER_ADDRESS
CENTER_EMAIL
CENTER_PHONE             # optionnel
CENTER_REGISTRATION_ID   # optionnel
CENTER_LOGO_PATH         # optionnel
```

`CENTER_NAME`, `CENTER_ADDRESS` et `CENTER_EMAIL` sont obligatoires et validés au démarrage du backend. Les champs optionnels sont affichés uniquement lorsqu'ils sont configurés. Le logo est un fichier local lisible par le moteur de génération PDF.

Le backend expose ces valeurs aux services documentaires au moyen d'un objet typé `IssuerIdentity`. Les modèles métier et les contrôleurs ne lisent pas directement les variables d'environnement.

Lors de l'émission d'une Facture ou d'un Certificat, les valeurs courantes sont copiées dans un instantané immuable du document. Une modification ultérieure de la configuration n'affecte que les nouveaux documents.

Il n'existe aucune collection MongoDB, API CRUD ou interface Admin pour modifier l'identité du centre. Une modification exige un changement de configuration et un redémarrage/redéploiement. Le nom et le logo non sensibles peuvent être fournis aux frontends par leur configuration de build ; aucun endpoint générique de paramètres publics n'est introduit.

L'objectif est de conserver un modèle centré sur la gestion réelle des formations.

---

# 21. API REST — Concepts

L'API doit couvrir au minimum les domaines suivants :

```text
/auth
/users
/trainers
/learners
/trainings
/modules
/lessons
/resources
/sessions
/schedules
/enrollments
/progress
/attendance
/payments
/invoices
/evaluations
/feedback
/certificates
/costs
/dashboard
/contact
/public/concierge/messages
/trainings/{id}/tutor/messages
```

La documentation OpenAPI générée est disponible sur `/api/openapi.json` et Swagger UI est disponible sur `/api/docs` lorsque le backend est démarré.

## 21.1 Authentification

Exemples :

```text
POST /api/auth/register        # Apprenant uniquement
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## 21.2 Utilisateurs et Formateurs

Exemples :

```text
GET  /api/trainers
POST /api/trainers             # Admin uniquement
GET  /api/trainers/{id}
PUT  /api/trainers/{id}
POST /api/trainers/{id}/disable
```

## 21.3 Formations et contenu

Exemples :

```text
GET    /api/trainings
GET    /api/trainings/{id}
POST   /api/trainings
PUT    /api/trainings/{id}
DELETE /api/trainings/{id}
POST   /api/trainings/{id}/archive

POST   /api/trainings/{id}/modules
PUT    /api/modules/{id}
DELETE /api/modules/{id}

POST   /api/modules/{id}/lessons
PUT    /api/lessons/{id}
DELETE /api/lessons/{id}

POST   /api/lessons/{id}/resources
PUT    /api/resources/{id}
DELETE /api/resources/{id}
```

## 21.4 Sessions

Les sessions sont réservées aux formations présentielles.

```text
GET  /api/sessions
GET  /api/sessions/{id}
POST /api/sessions
PUT  /api/sessions/{id}
POST /api/sessions/{id}/cancel

POST   /api/sessions/{id}/schedule
PUT    /api/schedules/{id}
DELETE /api/schedules/{id}
```

L'annulation d'une Session est autorisée uniquement lorsqu'elle ne possède aucune inscription.

## 21.5 Inscriptions et progression

```text
GET  /api/enrollments

GET  /api/progress
PUT  /api/progress/{id}
```

L'inscription payante n'est pas créée directement par un appel public à `/api/enrollments`. Elle est créée par le backend après confirmation du paiement par le webhook Stripe.

## 21.6 Paiements

```text
POST /api/payments/checkout
GET  /api/payments
GET  /api/payments/{id}

POST /api/payments/webhook/stripe
```

Le webhook Stripe doit être protégé et vérifié selon les mécanismes officiels de Stripe.

## 21.7 Évaluations

Exemples :

```text
GET  /api/evaluations
POST /api/evaluations
PUT  /api/evaluations/{id}
POST /api/evaluations/{id}/generate-ai
POST /api/evaluations/{id}/publish
POST /api/evaluations/{id}/submit
GET  /api/evaluations/{id}/results
```

La génération IA ne publie pas automatiquement l'évaluation.

## 21.8 Feedback

```text
POST /api/feedback
GET  /api/feedback              # Admin uniquement
```

La création vérifie l'éligibilité côté backend et refuse toute seconde note pour la même inscription.

## 21.9 Certificats

```text
GET  /api/certificates
GET  /api/certificates/{id}
POST /api/certificates/generate
GET  /api/certificates/{id}/pdf
```

La génération doit vérifier l'éligibilité côté backend.

La génération est idempotente et ne doit pas créer de doublons lorsqu'elle est demandée plusieurs fois pour la même éligibilité.

## 21.10 Coûts

```text
GET  /api/costs/trainers
PUT  /api/costs/trainers/{trainerId}/{year}/{month}

GET    /api/costs/trainings
POST   /api/costs/trainings
PUT    /api/costs/trainings/{id}
DELETE /api/costs/trainings/{id}
```

Ces endpoints sont réservés à l'Admin et n'acceptent que des montants explicitement saisis en EUR.

## 21.11 Dashboard, tuteur et concierge

```text
GET /api/dashboard/overview
GET /api/dashboard/participation
GET /api/dashboard/progress
GET /api/dashboard/satisfaction
GET /api/dashboard/financial
GET /api/dashboard/profitability
```

L'API finale doit être documentée avec Swagger/OpenAPI.

Les routes IA actuelles complètent les domaines précédents :

```text
POST /api/trainings/{id}/tutor/messages
POST /api/public/concierge/messages
POST /api/evaluations/{id}/generate-ai
```

La première impose le rôle Apprenant et une inscription; la deuxième est anonyme et strictement publique; la troisième impose le rôle Formateur et la propriété de l'évaluation brouillon.

---

# 22. Architecture technique et exploitation locale

| Couche | Implémentation actuelle |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, React Hook Form, Zod et Fetch |
| Mobile | React Native 0.86, Expo 57, TypeScript, React Navigation et Expo SecureStore |
| Backend | Node.js, Express 5, TypeScript, Mongoose, Zod, OpenAPI/Swagger UI |
| Base de données | MongoDB 8, replica set mono-nœud `rs0` |
| Paiement | Stripe Checkout et webhook signé, clés de test |
| Fichiers et documents | Stockage local protégé, PDFKit et Nodemailer |
| IA | SDK `@google/genai` / Gemini, uniquement côté serveur |
| Analytics | Firebase Analytics, uniquement côté navigateur après consentement |

L'environnement Docker Compose contient `backend`, `mongodb`, `mongodb-init` et `mailpit`. Le service `mongodb-init` prépare ou vérifie le replica set `rs0` et attend un primaire inscriptible; il est nécessaire aux flux transactionnels. Les volumes `mongodb_data` et `backend_uploads` conservent respectivement les données MongoDB et les fichiers protégés. Le backend est exposé localement sur le port 3000, MongoDB sur 27017 et Mailpit sur 8025. Le client Vite s'exécute séparément sur le port 5173.

La configuration est répartie dans trois fichiers ignorés par Git :

| Fichier | Responsabilité |
| --- | --- |
| `.env` | Surcharges Docker Compose pour Stripe, Gemini et le schéma de retour mobile |
| `Web/backend/.env` | Application, MongoDB, JWT, SMTP, Stripe, fichiers, Gemini et identité du centre |
| `Web/frontend/.env` | URL API, coordonnées publiques et Firebase Analytics |
| `Mobile/.env` | URL API mobile, nom du centre et schéma de deep link |

Les secrets JWT, Stripe, SMTP et Gemini restent exclusivement dans les fichiers serveur. Les variables `VITE_` et `EXPO_PUBLIC_` sont visibles par leur client et ne peuvent contenir aucun secret.

---

# 23. Architecture backend

La structure réellement utilisée est modulaire :

```text
Web/backend/src/
├── config/                 # Environnement et journalisation
├── infrastructure/         # MongoDB, fichiers, mail, PDF, Stripe, HTTP, OpenAPI
├── middleware/             # Authentification et limitation de requêtes
├── modules/                # Domaines métier : auth, trainings, content, payments,
│                           # enrollments, progress, sessions, attendance, evaluations,
│                           # certificates, feedback, costs, dashboard, tutor, concierge
├── scripts/                # Bootstrap Administrateur et données de développement
├── shared/                 # Erreurs, auth, base de données et utilitaires communs
├── app.ts
└── server.ts
```

Les routes délèguent aux services métier. Les DTO Zod valident les requêtes, les middlewares établissent l'identité et les services appliquent les règles d'autorisation avant la persistance. Les erreurs suivent un contrat centralisé. `server.ts` charge la configuration, établit MongoDB, initialise les index et démarre le serveur HTTP.

---

# 24. Modèle de données conceptuel

Entités principales implémentées :

```text
User
RefreshSession
PasswordResetToken

TrainingCategory
Training
TrainingModule
Lesson
TrainingResource

TrainingSession
SessionSchedule

Enrollment
LessonProgress
Attendance

Payment
Invoice
InvoiceItem

Evaluation
EvaluationQuestion
EvaluationAttempt
EvaluationAnswer
Feedback

Certificate

TrainerCost
TrainingCost
```

Il n'existe pas de collections `TrainerProfile` ou `LearnerProfile` séparées : les informations communes de profil sont portées par `User`. Les modèles ci-dessus correspondent à la persistance actuellement utilisée.

## 24.1 Relations principales

```text
Training 1 ───── N TrainingModule
TrainingModule 1 ───── N Lesson
Lesson 1 ───── N TrainingResource

Trainer 1 ───── N Training en tant que propriétaire unique

Training 1 ───── N TrainingSession
TrainingSession 1 ───── N SessionSchedule
TrainingSession N ───── N Trainer affecté

Learner 1 ───── N Enrollment
Enrollment ───── Formation OU Session selon le type

Enrollment self-paced 1 ───── N LessonProgress
Lesson 1 ───── N LessonProgress

Enrollment 1 ───── N Attendance
SessionSchedule 1 ───── N Attendance

Learner 1 ───── N Payment
Payment ───── Formation OU Session ciblée
Payment non réussi 1 ───── 0 Enrollment
Payment non réussi 1 ───── 0 Invoice
Payment réussi 1 ───── 1 Enrollment
Enrollment 1 ───── 1 Payment réussi
Payment réussi 1 ───── 1 Invoice
Invoice 1 ───── 1 InvoiceItem d'inscription

Training 1 ───── N Evaluation
Training 1 ───── 0..1 Evaluation certifiante publiée
Evaluation 1 ───── N EvaluationQuestion
Learner 1 ───── N EvaluationAttempt
EvaluationAttempt 1 ───── N EvaluationAnswer

Enrollment 1 ───── 0..1 Feedback
Training 1 ───── N Feedback

Enrollment 1 ───── 0..1 Certificate

Trainer 1 ───── N TrainerCost mensuel
Training 1 ───── N TrainingCost
TrainingSession 1 ───── N TrainingCost optionnellement rattaché
```

Les relations utilisent des références MongoDB, complétées par les identifiants parents nécessaires au filtrage, aux agrégations et à l'autorisation. Les index d'unicité et les transactions protègent les relations critiques, notamment autour du paiement, de l'inscription et de la facture.

---

# 25. Sécurité

Le backend doit appliquer les contrôles d'autorisation.

Prévoir notamment :

- hash sécurisé des mots de passe ;
- validation stricte des entrées ;
- protection contre les injections ;
- HTTPS en production ;
- CORS correctement configuré ;
- secrets hors Git ;
- gestion centralisée des exceptions ;
- logs sans données sensibles ;
- limitation des requêtes sensibles lorsque nécessaire ;
- contrôle d'accès aux ressources pédagogiques ;
- vérification serveur des certificats ;
- vérification serveur des paiements ;
- vérification serveur des permissions.

Exemples :

- seul l'Admin peut créer un compte Formateur ;
- seul l'Admin peut désactiver un utilisateur selon ses permissions ;
- un Formateur ne peut modifier que la Formation dont il est propriétaire ;
- un Formateur affecté à une Session peut gérer cette Session dans son périmètre opérationnel, sans modifier la Formation parente ;
- un Formateur ne peut modifier que les présences des Sessions auxquelles il est affecté ;
- un Apprenant ne consulte que ses propres inscriptions, progressions, paiements, résultats et certificats ;
- un Apprenant ne peut jamais attribuer son propre rôle ;
- un paiement confirmé doit provenir d'une confirmation backend fiable.

---

# 26. Gestion des fichiers

Les fichiers pédagogiques ne doivent pas être stockés directement dans MongoDB lorsque leur taille ou leur nature rend cela inadapté.

Le modèle métier peut utiliser :

```text
TrainingResource
├── FILE
│   └── StorageReference
└── EXTERNAL_URL
    └── ExternalUrl
```

Dans le périmètre actuel, les fichiers sont stockés uniquement sur le système de fichiers local persistant du backend. Le répertoire racine est défini par la variable d'environnement `UPLOAD_DIR` et ne doit pas être exposé comme répertoire statique public.

Le backend fournit les opérations d'upload et de téléchargement. Chaque accès vérifie l'identité, le rôle et l'autorisation de l'utilisateur sur la Formation concernée. Les fichiers ne disposent pas d'URL publique permanente.

Pour un fichier, `TrainingResource` conserve notamment :

- le nom original ;
- un nom de stockage généré par le backend ;
- un chemin relatif interne ;
- le type MIME ;
- la taille ;
- une empreinte de contrôle ;
- l'utilisateur ayant effectué l'upload ;
- la date d'upload.

Le backend doit empêcher les traversées de chemin et ne jamais utiliser directement le nom fourni par l'utilisateur comme chemin de stockage. L'extension, le type MIME, la signature réelle du fichier et la taille doivent être validés.

La taille maximale par défaut est de 20 Mo et peut être modifiée par `MAX_UPLOAD_SIZE_MB`.

Les ressources `EXTERNAL_URL` acceptent uniquement des URL valides utilisant `http` ou `https`. Le backend ne télécharge pas automatiquement leur contenu.

Les PDF de Certificat et de Facture utilisent également ce stockage local protégé.

Le déploiement doit monter `UPLOAD_DIR` sur un volume persistant. Cette version suppose une seule instance backend utilisant ce volume ; le stockage distribué et la réplication de fichiers sont hors périmètre.

Le changement de fournisseur de stockage ne doit pas modifier le concept métier `TrainingResource`.

---

# 27. Écrans Web principaux

## Public

- Accueil ;
- Catalogue ;
- Détail d'une formation ;
- Sessions disponibles pour les formations présentielles ;
- Connexion ;
- Inscription Apprenant.
- Concierge IA public flottant pour les visiteurs déconnectés.

Aucune inscription Formateur.

## Admin

- Dashboard ;
- Formations ;
- Modules / Lessons / Resources ;
- Sessions ;
- Planning ;
- Formateurs ;
- Apprenants ;
- Inscriptions ;
- Présences ;
- Paiements ;
- Factures ;
- Évaluations ;
- Certificats ;
- Feedbacks de satisfaction ;
- Coûts ;
- Rentabilité.

Aucun écran obligatoire `SiteSettings` ou `CompanySettings`.

## Formateur

- Dashboard ;
- Mes formations ;
- Contenu pédagogique ;
- Mes sessions présentielles ;
- Planning ;
- Apprenants ;
- Présences ;
- Évaluations ;
- Génération assistée par IA ;
- Résultats.

## Apprenant

- Dashboard ;
- Catalogue ;
- Mes inscriptions ;
- Mes formations ;
- Progression ;
- Mon planning ;
- Ressources ;
- Paiements ;
- Factures ;
- Évaluations ;
- Certificats ;
- Feedback de satisfaction ;
- Tuteur IA de la formation dans la lecture de contenu autorisée ;
- Profil.

## 27.1 Application mobile React Native

L'application mobile React Native fait partie du même projet. Son code se trouve dans `Mobile/` et utilise Expo, React Navigation et TypeScript. Elle constitue un client de l'API existante, sans serveur, base de données ou logique métier indépendante.

Elle :

- utilise le même backend Express ;
- utilise la même API REST et les mêmes contrats JSON ;
- utilise la même base MongoDB uniquement via l'API ;
- utilise la même authentification, les mêmes rôles et les mêmes permissions ;
- respecte les mêmes règles de propriété, d'inscription, de paiement, de progression, de présence, d'évaluation et de certification ;
- affiche les mêmes données métier adaptées à une interface tactile ;
- reprend l'identité visuelle de High Skills Academy grâce aux tokens de thème partagés dans l'application ;
- ne possède ni backend séparé, ni API propre, ni logique métier dupliquée.

La logique critique reste côté backend. En particulier, un retour de paiement, une décision d'autorisation, le calcul d'éligibilité d'un certificat ou la validation d'une réponse IA ne doivent jamais être décidés par le client mobile.

### Navigation et écrans actuellement implémentés

La navigation utilise React Navigation avec trois piles : invité, utilisateur authentifié et changement de mot de passe obligatoire. Les routes natives comprennent notamment :

| Espace | Écrans mobiles présents |
| --- | --- |
| Invité | Catalogue, détail de formation, connexion, inscription Apprenant, mot de passe oublié et réinitialisation |
| Commun authentifié | Espace de rôle, profil, catalogue, détail, contenu, sessions, achats/factures, évaluations et certificats |
| Apprenant | Progression, contenu autorisé, planning/sessions, paiements, factures, évaluations, certificats et feedback |
| Formateur | Formations gérées, édition de contenu avec documents, gestion des sessions et présences, évaluations, génération de questions IA, revue/publication et résultats |
| Administrateur | Dashboard, utilisateurs et Formateurs, catégories, coûts, supervision des formations/sessions/paiements/évaluations/certificats |

Le client mobile offre des états de chargement, vide, erreur et nouvelle tentative; la navigation est filtrée par le rôle connecté. Les écrans mobiles doivent rester adaptés au tactile tout en conservant :

- la terminologie et les règles du Web ;
- l'identité visuelle, les couleurs et la hiérarchie de contenu ;
- des composants cohérents, des zones d'action accessibles et des formulaires compacts ;
- des listes à une colonne, le défilement, le rafraîchissement et les alertes natives lorsque pertinents ;
- des workflows fonctionnellement équivalents, sans reproduction aveugle des grilles de bureau.

### Authentification et session mobile

Le jeton d'accès reste uniquement en mémoire. Le refresh token est reçu dans le corps des réponses lorsque `client: "MOBILE"` est envoyé à l'API, puis stocké dans `expo-secure-store` sous la clé `plateforme-formations.refresh-token`.

Au lancement, `AuthProvider` tente de rafraîchir la session. Le renouvellement est à vol unique afin d'éviter des appels concurrents. Lorsqu'un appel authentifié renvoie `401`, le client tente une rotation du refresh token, rejoue la requête une fois avec le nouveau jeton, puis repasse en état invité si le renouvellement échoue. La déconnexion appelle l'API lorsque possible puis efface SecureStore.

### Configuration et réseau mobile

`Mobile/.env` est construit à partir de `Mobile/.env.example` :

| Variable | Rôle | Valeur de développement / règle |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | URL de base de l'API | L'exemple utilise `http://10.0.2.2:3000/api` pour l'émulateur Android; un appareil réel doit utiliser une adresse réseau joignable du poste de développement, jamais `localhost` |
| `EXPO_PUBLIC_CENTER_NAME` | Nom affiché du centre | Valeur publique uniquement |
| `EXPO_PUBLIC_APP_SCHEME` | Schéma de deep link | Doit correspondre à `MOBILE_APP_SCHEME` côté backend; valeur par défaut `plateforme-formations` |

L'application valide ces trois valeurs au démarrage. L'URL API doit utiliser HTTP ou HTTPS et le schéma ne doit pas contenir `://`.

Le schéma Expo déclaré est `plateforme-formations`. Les deep links actuellement configurés couvrent la réinitialisation de mot de passe (`plateforme-formations://reset-password`) et le retour de paiement (`plateforme-formations://payments/:result`). Le backend utilise `MOBILE_APP_SCHEME` pour construire les retours Mobile de réinitialisation et Stripe Checkout.

Les commandes de travail existantes depuis la racine du dépôt sont :

```powershell
# Démarrer Expo
npm run dev:mobile

# Ouvrir Expo pour Android
npm run android --workspace @plateforme-formations/mobile

# Vérifier le typage, le lint et les tests mobiles
npm run typecheck --workspace @plateforme-formations/mobile
npm run lint --workspace @plateforme-formations/mobile
npm run test --workspace @plateforme-formations/mobile
```

Le lancement sur un émulateur Android utilise l'adresse spéciale `10.0.2.2` de l'exemple. Pour un appareil physique, la valeur `EXPO_PUBLIC_API_BASE_URL` doit être adaptée à une adresse LAN HTTPS/HTTP réellement accessible depuis l'appareil.

### Fonctions natives intégrées

- `expo-secure-store` pour le refresh token;
- `expo-document-picker` pour sélectionner les ressources de contenu;
- `expo-image-picker` pour choisir une miniature de formation;
- `expo-file-system` et `expo-sharing` pour télécharger puis partager les ressources, factures et certificats protégés;
- `Linking.openURL` pour les liens externes et la redirection Stripe Checkout dans le navigateur système;
- `react-native-safe-area-context`, défilement et composants natifs pour les interactions tactiles.

Le retour du navigateur après Stripe ne prouve jamais le paiement. L'écran `CheckoutReturn` interroge `/payments/:id` jusqu'à ce que le statut géré par le webhook backend ne soit plus `PENDING`; l'accès n'est proposé que lorsqu'une inscription est retournée.

### Limites de parité actuelles à respecter

Le mobile couvre déjà les domaines métier principaux ci-dessus, mais il ne possède pas actuellement :

- de widget concierge IA public ;
- d'interface de tuteur IA dans la lecture de contenu ;
- de dépendance Firebase, d'Analytics Firebase, de fichier de configuration Firebase natif ou de notification FCM.

Firebase reste une mesure Analytics propre au client Web dans la version actuelle. Tout ajout mobile futur de Firebase Analytics ou FCM devra enregistrer les applications natives dans le projet Firebase, conserver les secrets privilégiés côté backend et définir explicitement le consentement et les événements avant implémentation. Le tuteur et le concierge ne doivent être ajoutés au mobile qu'en réutilisant strictement les endpoints, rôles, limites et règles de grounding décrits aux sections 12.1 et 12.2.

---

# 28. Règles métier essentielles

1. L'email utilisateur est unique.
2. Chaque utilisateur possède un seul rôle.
3. L'inscription publique crée uniquement des comptes Apprenant.
4. Seul l'Admin crée les comptes Formateur.
5. Un utilisateur public ne peut pas choisir le rôle Admin ou Formateur.
6. Une formation possède exactement un type : `SELF_PACED_ONLINE` ou `IN_PERSON`.
7. Une formation self-paced ne nécessite pas de session.
8. Une formation présentielle utilise des sessions.
9. L'Apprenant s'inscrit à une formation pour le self-paced.
10. L'Apprenant s'inscrit à une session pour le présentiel.
11. Une session ne peut pas dépasser sa capacité ; cette limite est appliquée de manière atomique lors de la création d'une inscription après paiement confirmé.
12. Une Session ne peut être annulée ou supprimée que si elle ne possède aucune inscription ; une Session annulée ne reçoit pas de nouvelle inscription.
13. Un Apprenant ne peut pas avoir deux inscriptions équivalentes.
14. Les présences concernent les sessions présentielles.
15. Les ressources pédagogiques sont rattachées aux lessons.
16. Les contenus d'une formation self-paced sont préparés à l'avance par le Formateur.
17. Le Formateur contrôle et valide toute évaluation générée avec l'IA.
18. L'IA ne publie jamais seule une évaluation.
19. Le certificat est le seul document de réussite prévu dans le périmètre.
20. Aucune Attestation n'est implémentée.
21. Un certificat n'est généré que si les conditions d'éligibilité sont satisfaites.
22. Une Formation peut désigner au maximum une Évaluation publiée comme Évaluation certifiante ; lorsqu'elle est désignée, au moins une tentative réussie est obligatoire.
23. Chaque certificat possède un numéro unique.
24. Les revenus proviennent des paiements d'inscription des Apprenants.
25. Le système n'a pas de concept métier séparé « Impayé ».
26. Les paiements utilisent uniquement les statuts `PENDING`, `PAID`, `FAILED` et `CANCELLED` ; ces statuts restent propres à `Payment` et ne sont pas reproduits dans `Enrollment`. Aucun remboursement n'est géré dans le périmètre actuel.
27. Le webhook Stripe backend est la source de vérité d'une confirmation de paiement Stripe ; seule cette confirmation permet au backend de créer l'inscription active et d'accorder l'accès.
28. Les coûts ne doivent jamais être inventés.
29. Le coût fixe/salaire des Formateurs peut être représenté pour les calculs de rentabilité.
30. Les autres coûts ne sont pris en compte que s'ils sont explicitement enregistrés.
31. Les données financières doivent permettre de distinguer revenus, coûts et résultat.
32. L'archivage d'une formation ne détruit pas son historique.
34. Il n'existe pas de multi-tenant ou multi-organisation.
35. Il n'existe pas de `SiteSettings` ou `CompanySettings` sans besoin fonctionnel concret.
36. Il n'existe pas de mode self-paced en dehors du type explicitement défini `SELF_PACED_ONLINE`.
37. La plateforme ne développe pas son propre système de visioconférence.
38. Les liens externes de ressources et, si nécessaire, d'outils externes ne transforment pas ces services en intégrations propriétaires.
39. Chaque Formation possède exactement un Formateur propriétaire.
40. Le Formateur qui crée une Formation en devient le propriétaire ; l'Admin doit désigner le propriétaire d'une Formation qu'il crée.
41. Seul l'Admin peut transférer la propriété d'une Formation.
42. Une Session présentielle peut être affectée à un ou plusieurs Formateurs par l'Admin ou par le propriétaire de la Formation.
43. L'affectation à une Session ne donne pas le droit de modifier la Formation parente, son contenu ou ses évaluations.
44. Une Formation self-paced est terminée lorsque 100 % de ses lessons ont été explicitement marquées comme terminées ; le suivi des ressources reste informatif.
45. Une Formation présentielle est terminée pour la certification lorsque la Session est Terminée et que la règle de présence applicable est satisfaite.
46. La génération d'un Certificat est une opération backend idempotente qui recalcule l'éligibilité et ne peut pas être forcée par l'Admin.
47. Les Évaluations utilisent uniquement les questions `SINGLE_CHOICE`, `MULTIPLE_CHOICE` et `TRUE_FALSE`, corrigées automatiquement sans crédit partiel.
48. Une Évaluation suit le cycle `DRAFT`, `PUBLISHED`, `ARCHIVED` ; seule une Évaluation `DRAFT` est modifiable.
49. Le seuil de réussite et le nombre maximal de tentatives sont définis par le Formateur propriétaire ; la valeur par défaut du nombre de tentatives est trois et la durée est optionnelle.
50. Une tentative soumise ou expirée est immuable ; son score et son résultat sont calculés par le backend.
51. Les bonnes réponses et explications ne sont visibles qu'après réussite ou après utilisation de la dernière tentative autorisée.
52. Les seuls statuts de présence sont `PRESENT` et `ABSENT` ; aucun statut de retard ou d'absence justifiée n'existe.
53. Une présence est unique pour une combinaison `Enrollment + SessionSchedule` et une absence d'enregistrement ne signifie pas `ABSENT`.
54. `PRESENT` compte entièrement dans le pourcentage de présence ; `ABSENT` ne compte pas et aucun calcul pondéré par la durée n'est appliqué.
55. Le seuil minimal de présence est défini sur la Formation présentielle, avec une valeur par défaut de 80 %.
56. Une Session ne peut devenir Terminée que lorsque toutes les présences attendues ont été saisies ; elles deviennent alors immuables.
57. Une Session contient une ou plusieurs entrées `SessionSchedule` et peut ainsi être organisée sur plusieurs dates distinctes sans créer plusieurs Sessions.
58. Un `TrainerCost` est un coût mensuel explicitement saisi pour un Formateur ; il est unique par Formateur, année et mois.
59. Les salaires des Formateurs ne sont ni générés automatiquement ni alloués automatiquement aux Formations ou Sessions.
60. Un `TrainingCost` est une dépense explicite rattachée à une Formation et, si pertinent, à une Session.
61. Le résultat global correspond aux revenus confirmés diminués des `TrainerCost` et `TrainingCost` enregistrés pour la période.
62. La rentabilité correspond au résultat global divisé par les revenus confirmés ; son pourcentage vaut `null` lorsque les revenus sont nuls.
63. La devise unique de la plateforme est le euro (`EUR`) avec une précision de paiement de `0,01 EUR` compatible avec Stripe.
64. Tous les montants sont stockés sous forme d'entiers dans l'unité mineure attendue par Stripe ; aucun calcul monétaire n'utilise de nombre flottant.
65. La plateforme ne calcule aucune taxe ; le sous-total et le total d'une Facture sont identiques.
66. Un paiement réussi génère automatiquement et de manière idempotente une Facture unique contenant une ligne d'inscription.
67. Une Facture conserve des instantanés immuables des identités, de la description, du montant et de la devise au moment de son émission.
68. Chaque Formation possède un prix strictement positif en EUR ; aucune Formation gratuite n'est prévue.
69. Le type d'une Formation est obligatoire et définitivement immuable dès sa création.
70. Aucun workflow de conversion ou de migration entre `SELF_PACED_ONLINE` et `IN_PERSON` n'est prévu ; une autre modalité exige une nouvelle Formation.
71. La timezone métier unique est `Africa/Tunis` ; les instants sont stockés en UTC et échangés au format ISO 8601 avec offset explicite ou `Z`.
72. Les dates de début et de fin d'une Session sont dérivées de ses entrées `SessionSchedule`.
73. Le backend refuse les chevauchements de planning pour un même Formateur ou une même combinaison lieu + salle parmi les Sessions non annulées.
74. Les entrées adjacentes et les entrées parallèles utilisant des Formateurs et salles différents sont autorisées.
75. La plateforme ne gère ni timezone par utilisateur ou Session ni détection des conflits personnels des Apprenants.
76. Les fichiers sont stockés dans un répertoire backend local persistant défini par `UPLOAD_DIR` et ne sont jamais exposés comme fichiers statiques publics.
77. Les uploads sont autorisés et validés par le backend ; la taille maximale par défaut est de 20 Mo et peut être configurée par `MAX_UPLOAD_SIZE_MB`.
78. L'extraction IA est effectuée à la demande uniquement pour les PDF textuels, DOCX, PPTX et TXT de la Formation sélectionnée.
79. Aucun OCR, téléchargement automatique d'URL externe, stockage distribué, système d'embeddings, base vectorielle ou pipeline RAG n'est introduit.
80. Si aucun contenu textuel exploitable n'existe, la génération IA est refusée explicitement ; toute sortie IA valide reste un brouillon contrôlé par le Formateur propriétaire.
81. Le premier Admin est créé uniquement par une commande CLI/seed idempotente et doit modifier son mot de passe initial lors de sa première connexion.
82. Seul l'Admin crée un Formateur avec un mot de passe temporaire que le Formateur doit modifier lors de sa première connexion.
83. L'authentification utilise un JWT d'accès de 15 minutes et un refresh token rotatif de 7 jours stocké sous forme d'empreinte et révocable.
84. La déconnexion révoque le refresh token courant ; le changement de mot de passe et la désactivation révoquent tous les refresh tokens.
85. Chaque requête protégée vérifie l'existence et l'état actif de l'utilisateur.
86. Les jetons de réinitialisation sont à usage unique, stockés sous forme d'empreinte, expirent après 30 minutes et sont transmis par SMTP.
87. La création d'Admins supplémentaires et l'invitation de Formateurs par email sont hors périmètre du MVP.
88. La suppression définitive est limitée aux brouillons et éléments sans historique métier ; les éléments déjà utilisés sont archivés, annulés ou désactivés selon leur nature.
89. Les paiements, Factures, Certificats, tentatives soumises, présences et progressions terminées ne sont jamais supprimés définitivement.
90. Aucune suppression en cascade d'un historique métier n'est autorisée ; une demande de suppression incompatible retourne une erreur de conflit.
91. Un fichier local est supprimé uniquement avec sa ressource définitivement supprimée et lorsqu'aucune autre référence n'existe.
92. Chaque tentative Stripe correspond à un `Payment` ; un paiement non réussi ne crée ni inscription ni Facture.
93. Un `Payment` réussi crée exactement une `Enrollment` et une Facture, et chaque `Enrollment` référence exactement son paiement réussi.
94. Une `Enrollment` peut produire au maximum un Certificat ; les demandes répétées retournent l'enregistrement existant.
95. La régénération technique d'un PDF ne crée ni nouvel enregistrement, ni nouveau numéro de Facture ou de Certificat.
96. Des index uniques garantissent l'idempotence des événements Stripe, des relations Payment/Enrollment/Invoice, et des numéros de Facture et de Certificat.
97. La progression self-paced appartient à l'inscription ; une progression de lesson est unique par combinaison `Enrollment + Lesson`.
98. Le pourcentage de progression est calculé à partir des lessons terminées et n'est jamais modifié directement.
99. Une inscription créée après paiement confirmé est permanente dans le périmètre actuel : elle ne peut pas être annulée et l'Apprenant ne peut pas se réinscrire à la même cible équivalente.
100. Deux inscriptions sont équivalentes pour un même Apprenant lorsqu'elles ciblent la même Formation self-paced ou la même Session présentielle ; des Sessions différentes restent autorisées.
101. Les progressions utilisées pour un Certificat deviennent immuables après son émission.
102. Une nouvelle lesson affecte la progression des inscriptions actives non certifiées, mais ne remet pas en cause les Certificats déjà délivrés.
103. L'identité du centre utilisée pour les Factures et Certificats provient exclusivement de variables d'environnement validées au démarrage.
104. Chaque Facture et Certificat conserve un instantané immuable de l'identité du centre au moment de son émission.
105. Aucune collection, API ou interface `CompanySettings`, `SiteSettings` ou équivalent n'est introduite pour gérer cette identité.
106. Une Formation self-paced ne peut être publiée que si elle contient au moins un Module et une Lesson ; une Formation présentielle peut être publiée sans Session, mais aucun paiement n'est possible tant qu'aucune Session planifiée et disponible n'est sélectionnable.
107. Un Apprenant peut créer un unique Feedback pour une inscription lorsque la Formation est terminée et que l'Évaluation certifiante éventuelle a été réussie.
108. Un Feedback contient uniquement une note entière de 1 à 5, devient immuable après création et ne comporte ni commentaire ni workflow de modération.
109. Les statistiques Admin exposent le nombre, la moyenne et la distribution des Feedbacks, globalement et par Formation.

---

# 29. Besoins non fonctionnels

| ID | Exigence | Priorité |
|---|---|---|
| NFR-01 | Sécurité des mots de passe, données et accès | Haute |
| NFR-02 | Validation et autorisation côté backend | Haute |
| NFR-03 | Performance adaptée aux opérations courantes | Haute |
| NFR-04 | Interface responsive et ergonomique | Haute |
| NFR-05 | Architecture maintenable et extensible | Haute |
| NFR-06 | Compatibilité Web et mobile avec une API métier commune | Haute |
| NFR-07 | Traçabilité des paiements et certificats | Haute |
| NFR-08 | Protection minimale des données personnelles : collecte limitée aux besoins du projet, contrôle d'accès, modification du profil, désactivation du compte et absence de données sensibles dans les logs ; aucun module RGPD dédié | Haute |

---

# 30. Tests

Les tests doivent couvrir au minimum :

## Backend

- inscription Apprenant ;
- interdiction de création publique Formateur ;
- création Formateur par Admin ;
- authentification ;
- autorisation ;
- formations ;
- modules ;
- lessons ;
- ressources ;
- sessions ;
- capacité ;
- inscriptions ;
- progression ;
- présences ;
- paiements ;
- webhook Stripe ;
- idempotence des webhooks ;
- factures ;
- évaluations ;
- génération IA ;
- tuteur IA, citations et accès par inscription ;
- concierge public, sources autorisées, honeypot et limitations ;
- validation Formateur ;
- certificats ;
- feedbacks et contrôle de leur éligibilité ;
- calculs financiers ;
- statistiques, y compris les indicateurs de satisfaction.

## Frontend Web

- formulaires ;
- authentification ;
- guards ;
- affichage par rôle ;
- catalogue ;
- inscriptions ;
- contenu ;
- progression ;
- sessions ;
- paiement ;
- évaluations ;
- certificats ;
- feedback de satisfaction ;
- états loading/error/empty.
- consentement Firebase, page views et mesure des recommandations.

## Mobile

- validation de l'environnement `EXPO_PUBLIC_*` ;
- stockage SecureStore, rotation de session et reprise après `401` ;
- navigation par rôle et deep links de réinitialisation/paiement ;
- catalogue, détail, contenu, progression, sessions et présences ;
- paiement Checkout, interrogation du statut backend et partage des documents protégés ;
- évaluations, génération de questions, certificats, feedback, coûts et écrans d'administration ;
- états de chargement, vide, erreur, nouvelle tentative et adaptation tactile.

# 31. Workflow métier principal

## Formation self-paced

```text
Admin/Formateur
    ↓
Création de la Formation
    ↓
Modules
    ↓
Lessons
    ↓
Ressources
    ↓
Publication
    ↓
Apprenant crée son compte
    ↓
Paiement Stripe
    ↓
Webhook backend confirmé
    ↓
Création de l'inscription active
    ↓
Accès au contenu
    ↓
Progression
    ↓
Évaluation
    ↓
Réussite
    ↓
Certificat
    ↓
Feedback de satisfaction
```

## Formation présentielle

```text
Admin/Formateur
    ↓
Création de la Formation
    ↓
Création de la Session
    ↓
Planning
    ↓
Affectation du Formateur
    ↓
Apprenant crée son compte
    ↓
Choix d'une Session
    ↓
Paiement Stripe
    ↓
Webhook backend confirmé
    ↓
Création de l'inscription active
    ↓
Session
    ↓
Présences
    ↓
Évaluation
    ↓
Réussite
    ↓
Certificat
    ↓
Feedback de satisfaction
```

---

# 32. Architecture de dépôt actuelle

```text
training-platform/
├── Web/
│   ├── backend/
│   └── frontend/
├── Mobile/
│   ├── src/
│   ├── assets/
│   ├── tests/
│   ├── .env.example
│   └── app.json
├── Docs/
├── .gitignore
├── README.md
└── docker-compose.yml
```

La structure exacte peut évoluer sans modifier les règles fonctionnelles de ce document.

---

# 33. Définition de Done

Une fonctionnalité est considérée comme terminée lorsque, selon sa nature, elle possède :

- modèle de données ;
- logique métier ;
- API ;
- DTOs/types ;
- validation ;
- autorisation ;
- gestion des erreurs ;
- interface Web si pertinente ;
- interface mobile équivalente ou décision de non-parité explicitement documentée ;
- états loading/error/empty ;
- tests ;
- documentation technique pertinente.

---

# 34. Hors périmètre explicite

Ne pas implémenter spontanément :

- multi-tenant ;
- multi-organisation ;
- `SiteSettings` ;
- `CompanySettings` ;
- self-paced alternatif au type défini ;
- visioconférence propriétaire ;
- streaming vidéo propriétaire ;
- intégrations propriétaires Zoom/Teams/Google Meet ;
- stockage de cartes bancaires ;
- paiement réel pendant le développement ;
- remboursements, avoirs ou annulation d'une inscription ;
- formations gratuites ;
- certificats de type Attestation ;
- concept métier « Impayé » ;
- fonctionnalités financières non alimentées par des données réelles ;
- module RGPD dédié, workflow automatisé d'export/effacement, moteur d'anonymisation, gestion de consentements versionnés ou planificateur de rétention ;
- prédiction d'abandon ;
- prédiction d'inscription ;
- fonctionnalités non demandées.

Stripe en **mode test**, le tuteur IA, le concierge IA public, la génération IA d'évaluations et Firebase Analytics après consentement font partie du périmètre actuel et ne doivent donc pas être traités comme des fonctionnalités hors MVP.

---

# 35. État d'implémentation et priorités futures

Les domaines suivants sont implémentés dans la version actuelle : architecture et configuration, MongoDB, authentification, utilisateurs, formations, contenu, progression, sessions, paiements Stripe de test, inscriptions, factures, présences, évaluations, certificats, feedbacks, coûts, tableaux de bord, tuteur IA, concierge IA public et Firebase Analytics avec consentement.

Les priorités restantes relèvent d'une évolution de déploiement plutôt que d'un manque de domaine métier : gestion de secrets de production, stockage objet et sauvegardes, observabilité, mécanisme de limitation partagé entre plusieurs instances, validation Stripe de production et étude d'utilisabilité avec des utilisateurs réels.

---

# 36. Principes de conception à respecter

1. Le backend est la source de vérité pour les règles métier.
2. Le frontend ne doit jamais être la seule barrière de sécurité.
3. Le mobile consomme le même backend, les mêmes contrats et les mêmes règles métier; il ne les réimplémente pas côté client.
4. L'IA assiste les utilisateurs dans une frontière de sources autorisées; elle ne remplace pas une décision métier.
5. Stripe confirme les paiements via le webhook backend.
6. Les coûts financiers doivent provenir de données explicites.
7. Le modèle de données doit rester simple et centré sur les besoins réels.
8. Ne pas créer une abstraction uniquement pour anticiper une fonctionnalité future.
9. Ne pas ajouter de fonctionnalité importante sans exigence correspondante ou validation explicite.
10. Toute ambiguïté architecturale importante doit être signalée avant implémentation.
11. Les décisions nouvelles doivent être répercutées dans ce Source of Truth avant de devenir une nouvelle référence de développement.

---

# 37. Document d'autorité

Ce document constitue **la spécification du système**, et non un prompt d'implémentation.

Il décrit :

- ce que le système doit être ;
- ce qu'il doit permettre ;
- ses règles métier ;
- ses concepts ;
- ses contraintes ;
- son architecture fonctionnelle et technique de référence.

Les instructions de développement Web sont maintenues dans des documents séparés lorsque cela est nécessaire.
