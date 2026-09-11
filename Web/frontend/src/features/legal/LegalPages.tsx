import { Link } from 'react-router';
import { AnalyticsPreferences } from '../../core/analytics/AnalyticsPreferences.js';

const effectiveDate = '9 septembre 2026';
const supportEmail =
  import.meta.env.VITE_CENTER_EMAIL ?? 'contact.hsa.tn@gmail.com';

function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  intro: string;
}>) {
  return (
    <section className="static-page legal-page">
      <header className="legal-header">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="lead">{intro}</p>
        <p className="legal-date">Version du {effectiveDate}</p>
      </header>
      <aside className="legal-review-notice" role="note">
        Ce document est un projet fondé sur le fonctionnement actuellement
        visible dans l’application. Il doit être validé et adapté par un
        professionnel du droit avant la mise en production.
      </aside>
      <div className="legal-content">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Confidentialité"
      title="Politique de confidentialité"
      intro="Cette politique décrit les données traitées par High Skills Academy à travers le site Web, l’application mobile et les services associés."
    >
      <section>
        <h2>1. Responsable et contact</h2>
        <p>
          High Skills Academy exploite la plateforme. Pour toute question sur
          vos données, écrivez à{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. L’identité
          juridique complète du responsable, son adresse légale et son numéro
          d’immatriculation doivent être confirmés avant publication.
        </p>
      </section>
      <section>
        <h2>2. Données traitées</h2>
        <ul>
          <li>
            <strong>Compte :</strong> email, prénom, nom, rôle, état du compte
            et dates de création ou mise à jour.
          </li>
          <li>
            <strong>Sécurité :</strong> mot de passe haché, sessions et jetons
            hachés côté serveur, demandes de réinitialisation et date de
            changement du mot de passe. Le jeton de renouvellement est placé
            dans un cookie HttpOnly sur le Web et dans le stockage sécurisé de
            l’appareil sur mobile.
          </li>
          <li>
            <strong>Formation :</strong> inscriptions, progression, sessions,
            planning, présence, évaluations, réponses, résultats, satisfaction
            et certificats.
          </li>
          <li>
            <strong>Paiement :</strong> formation ou session achetée, montant en
            euros, état du paiement, références Stripe, éventuelles informations
            d’échec et factures. Les données de carte sont saisies auprès de
            Stripe et ne sont pas demandées par nos formulaires.
          </li>
          <li>
            <strong>Contenus :</strong> formations, ressources et fichiers
            téléversés par les personnes autorisées.
          </li>
          <li>
            <strong>Support :</strong> nom, email, objet et contenu envoyés via
            le formulaire de contact. L’application les transmet par email et ne
            comporte pas de collection de base de données dédiée à ces messages.
          </li>
          <li>
            <strong>Notifications :</strong> identifiant de notification
            Android, version de l’application et date de dernière utilisation
            lorsque les notifications sont activées.
          </li>
          <li>
            <strong>Technique :</strong> adresse IP utilisée par la limitation
            de débit et informations de requête présentes dans les journaux
            serveur. Les en-têtes d’autorisation, cookies, jetons et secrets
            sont configurés pour être masqués dans ces journaux.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Finalités</h2>
        <p>
          Ces données servent à créer et sécuriser les comptes, fournir les
          formations, suivre la progression, organiser les sessions, évaluer les
          acquis, délivrer les certificats, gérer les paiements et factures,
          répondre au support, envoyer les communications opérationnelles et
          protéger le service contre les abus.
        </p>
        <p>
          Le code examiné ne comporte pas de liste marketing ni de mécanisme de
          vente de données. Les emails configurés sont transactionnels :
          accueil, sécurité, inscription, session, progression et certificat.
        </p>
      </section>
      <section>
        <h2>4. Prestataires</h2>
        <ul>
          <li>
            <strong>Stripe</strong> héberge le paiement et retourne les états
            nécessaires à l’inscription et à la facturation.
          </li>
          <li>
            <strong>Google Gemini</strong> traite les messages adressés au
            concierge public ou au tuteur, ainsi que le contenu pédagogique
            transmis pour générer des questions d’évaluation.
          </li>
          <li>
            <strong>Firebase</strong> peut fournir les notifications Android et,
            après accord facultatif, Analytics.
          </li>
          <li>
            <strong>Le fournisseur SMTP/email</strong> traite les messages de
            support et emails opérationnels.
          </li>
          <li>
            <strong>MongoDB et l’hébergeur de l’application</strong> traitent
            les données applicatives et les fichiers selon le déploiement
            retenu.
          </li>
        </ul>
        <p>
          Les prestataires, lieux d’hébergement, transferts internationaux et
          garanties contractuelles réels doivent être documentés par
          l’exploitant avant la production.
        </p>
      </section>
      <section>
        <h2>5. Intelligence artificielle</h2>
        <p>
          Ne transmettez pas de mot de passe, donnée bancaire ou information
          sensible aux assistants. Les échanges récents du concierge ou du
          tuteur et le contexte de formation utile sont envoyés à Gemini pour
          produire une réponse. Les réponses peuvent être inexactes. Les
          formateurs doivent contrôler les questions générées avant usage.
        </p>
      </section>
      <section>
        <h2>6. Statistiques et stockage local</h2>
        <p>
          Firebase Analytics est désactivé tant qu’il n’est pas configuré et que
          vous ne l’avez pas accepté. En cas d’accord, la plateforme mesure les
          écrans/pages et les impressions, clics et inscriptions issus des
          recommandations avec l’identifiant et la catégorie d’une formation,
          sans envoyer le nom, l’email ni les données de paiement dans les
          événements définis par l’application.
        </p>
        <p>
          Le Web mémorise le choix Analytics dans localStorage et une
          attribution de recommandation dans sessionStorage pendant au plus sept
          jours. Le mobile utilise son stockage sécurisé pour ce choix,
          l’attribution et le jeton de renouvellement.
        </p>
      </section>
      <section>
        <h2>7. Conservation et demandes</h2>
        <p>
          Les jetons de réinitialisation expirent automatiquement ; les sessions
          ont une durée configurée. Aucune durée générale de conservation ou
          procédure automatisée de suppression de compte n’est actuellement
          définie dans le code. Elles doivent être fixées avant la production en
          tenant compte des obligations liées aux paiements, factures,
          attestations et historiques pédagogiques.
        </p>
        <p>
          Pour demander l’accès, la correction ou la suppression de données,
          consultez les{' '}
          <Link to="/data-deletion">instructions de suppression</Link>. Les
          droits applicables et délais de réponse dépendent de la juridiction et
          nécessitent une validation juridique.
        </p>
      </section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Cadre d’utilisation"
      title="Conditions générales d’utilisation et de service"
      intro="Ces conditions encadrent l’accès à la plateforme, aux formations, aux sessions et aux services payants."
    >
      <section>
        <h2>1. Compte</h2>
        <p>
          Vous devez fournir des informations exactes, protéger vos identifiants
          et signaler rapidement tout usage non autorisé. Un compte est
          personnel. Les comptes Formateur sont créés par l’administration ;
          l’inscription publique crée un compte Apprenant.
        </p>
      </section>
      <section>
        <h2>2. Usage autorisé</h2>
        <p>
          Vous ne devez pas contourner les contrôles d’accès, perturber le
          service, introduire du contenu malveillant, partager des contenus
          auxquels vous n’avez pas droit ou utiliser la plateforme d’une manière
          illicite. L’accès peut être suspendu lorsqu’un compte est désactivé
          par l’administration.
        </p>
      </section>
      <section>
        <h2>3. Formations et disponibilité</h2>
        <p>
          Les contenus, horaires, formateurs et critères de progression sont
          présentés dans la plateforme. Une formation peut être archivée et une
          session modifiée ou annulée. Les conditions commerciales à appliquer
          dans ces situations doivent être précisées par High Skills Academy
          avant publication.
        </p>
      </section>
      <section>
        <h2>4. Paiements</h2>
        <p>
          Le paiement est réalisé sur Stripe. Un retour dans l’application ne
          constitue pas une confirmation : seul l’état vérifié par le serveur
          déclenche l’inscription. Les prix sont affichés en euros dans le code
          actuel. Consultez la{' '}
          <Link to="/refund-policy">
            politique de remboursement et d’annulation
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>5. Certificats et évaluations</h2>
        <p>
          La délivrance d’un certificat dépend des critères de progression,
          présence et évaluation configurés pour la formation. Un certificat ne
          constitue pas une qualification réglementée sauf indication distincte,
          vérifiée et publiée par High Skills Academy.
        </p>
      </section>
      <section>
        <h2>6. Assistants IA</h2>
        <p>
          Les réponses générées par Gemini sont proposées comme aide et peuvent
          contenir des erreurs. Elles ne remplacent pas les informations
          confirmées par l’équipe, un formateur ou les contenus officiels du
          parcours.
        </p>
      </section>
      <section>
        <h2>7. Propriété et contenus</h2>
        <p>
          Les droits portant sur la marque, les formations et les ressources
          restent ceux de leurs titulaires. Aucun transfert de propriété n’est
          accordé par l’achat d’un accès. Les licences précises accordées aux
          utilisateurs et formateurs doivent être validées juridiquement.
        </p>
      </section>
      <section>
        <h2>8. Responsabilité et droit applicable</h2>
        <p>
          Aucune clause de limitation de responsabilité, loi applicable,
          juridiction compétente ou médiation n’est affirmée dans ce projet,
          faute d’informations juridiques vérifiées. Ces clauses doivent être
          rédigées par un professionnel avant la production.
        </p>
      </section>
      <section>
        <h2>9. Contact</h2>
        <p>
          Questions sur ces conditions :{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </section>
    </LegalPage>
  );
}

export function CookiePolicyPage() {
  return (
    <LegalPage
      eyebrow="Stockage sur votre appareil"
      title="Politique relative aux cookies et traceurs"
      intro="La plateforme utilise un cookie de session nécessaire et, uniquement avec votre accord, Firebase Analytics."
    >
      <section>
        <h2>Cookie strictement nécessaire</h2>
        <p>
          Sur le Web, le cookie <code>refresh_token</code> maintient la session.
          Il est HttpOnly, limité aux routes d’authentification, SameSite=Lax et
          Secure en production. Il ne sert pas à la publicité et sa durée
          correspond à celle de la session configurée.
        </p>
      </section>
      <section>
        <h2>Mesure d’audience facultative</h2>
        <p>
          Firebase Analytics ne démarre qu’après votre accord lorsque le service
          est configuré. Les événements définis mesurent les pages ou écrans et
          le parcours de recommandation de formations. Vous pouvez accepter ou
          refuser depuis la bannière affichée lors de votre première visite.
        </p>
      </section>
      <section>
        <h2>Autres stockages</h2>
        <p>
          Le choix Analytics est conservé dans localStorage. L’attribution d’une
          recommandation est conservée dans sessionStorage et supprimée après
          conversion, invalidité ou expiration (sept jours). Ces stockages ne
          sont pas des cookies, mais sont décrits ici par transparence.
        </p>
      </section>
      <section>
        <h2>Modifier votre choix</h2>
        <p>
          Vous pouvez modifier à tout moment votre choix concernant les
          statistiques facultatives.
        </p>
        <AnalyticsPreferences />
      </section>
    </LegalPage>
  );
}

export function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Paiements"
      title="Politique de remboursement et d’annulation"
      intro="Ce projet explique le traitement technique actuel des paiements sans inventer de délai ou de droit commercial non validé."
    >
      <section>
        <h2>Paiement non confirmé</h2>
        <p>
          Un paiement annulé, échoué ou encore en attente ne déclenche pas
          d’inscription. Vérifiez son état dans « Mes achats ». En cas de débit
          visible sans accès, contactez le support avec l’email du compte, la
          formation et la date approximative — jamais avec un numéro de carte
          complet.
        </p>
      </section>
      <section>
        <h2>Demande d’annulation ou de remboursement</h2>
        <p>
          Adressez la demande à{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. High Skills
          Academy doit définir et faire valider avant production les délais,
          critères d’éligibilité, traitement des formations commencées, sessions
          déplacées ou annulées, frais éventuels et délai de remboursement.
        </p>
      </section>
      <section>
        <h2>Traitement</h2>
        <p>
          Le code actuel enregistre les états Stripe et les factures, mais ne
          contient pas de parcours utilisateur ni d’API de remboursement. Toute
          demande nécessite donc une vérification manuelle. Ne considérez aucun
          remboursement comme accordé avant confirmation écrite et mise à jour
          effective auprès du moyen de paiement.
        </p>
      </section>
      <section>
        <h2>Droits impératifs</h2>
        <p>
          Cette politique ne limite aucun droit auquel il ne peut être renoncé.
          Les règles de rétractation, d’annulation et de remboursement
          applicables dépendent du pays, du type de prestation et du démarrage
          du service ; elles doivent être confirmées par un professionnel du
          droit.
        </p>
      </section>
    </LegalPage>
  );
}

export function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Votre compte"
      title="Demander la suppression de votre compte et de vos données"
      intro="La plateforme ne dispose pas encore d’une suppression en libre-service. Voici le canal actuellement disponible."
    >
      <section>
        <h2>Envoyer une demande</h2>
        <ol>
          <li>
            Écrivez depuis l’adresse associée au compte à{' '}
            <a
              href={`mailto:${supportEmail}?subject=Demande%20de%20suppression%20de%20compte`}
            >
              {supportEmail}
            </a>
            .
          </li>
          <li>
            Indiquez « Demande de suppression de compte » et votre prénom et
            nom. Ne joignez ni mot de passe, ni pièce bancaire.
          </li>
          <li>
            L’équipe devra vérifier votre identité par un moyen proportionné
            avant toute action irréversible.
          </li>
        </ol>
      </section>
      <section>
        <h2>Données concernées</h2>
        <p>
          La demande peut concerner le profil, les sessions, notifications,
          inscriptions, progression, présence, évaluations, satisfaction et
          autres données associées. Certaines données peuvent devoir être
          conservées ou dissociées du compte lorsqu’elles sont nécessaires aux
          obligations comptables, aux factures, à la preuve d’une formation ou à
          la prévention des abus.
        </p>
      </section>
      <section>
        <h2>Limite actuelle</h2>
        <p>
          Le code ne définit ni workflow, ni délai, ni politique de conservation
          globale pour ces demandes. High Skills Academy doit établir une
          procédure interne, les responsabilités, les délais et les règles de
          conservation avec un professionnel du droit avant la production.
        </p>
      </section>
    </LegalPage>
  );
}
