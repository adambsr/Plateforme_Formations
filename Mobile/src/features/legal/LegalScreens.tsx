import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  AppStackParamList,
  GuestStackParamList,
  LegalKind,
} from '../../app/navigation/types';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { AnalyticsPreferences } from '../../core/analytics/AnalyticsPreferences';

const supportEmail =
  process.env.EXPO_PUBLIC_CENTER_EMAIL ?? 'contact.hsa.tn@gmail.com';

type Section = { title: string; paragraphs: string[]; items?: string[] };
type LegalDocument = { title: string; intro: string; sections: Section[] };

const documents: Record<LegalKind, LegalDocument> = {
  privacy: {
    title: 'Politique de confidentialité',
    intro:
      'Données traitées par le site, l’application mobile et les services High Skills Academy.',
    sections: [
      {
        title: 'Données de compte et de sécurité',
        paragraphs: [
          'Nous traitons l’email, le prénom, le nom, le rôle, l’état du compte et les dates associées. Les mots de passe et jetons sont hachés côté serveur. Le jeton de renouvellement mobile est placé dans le stockage sécurisé de l’appareil.',
        ],
      },
      {
        title: 'Formation et paiements',
        paragraphs: [
          'La plateforme enregistre inscriptions, progression, sessions, présence, évaluations, réponses, résultats, satisfaction, certificats, achats et factures.',
          'Stripe traite la saisie des données de carte. L’application conserve la formation ou session, le montant en euros, l’état et les références de paiement nécessaires, mais ne demande pas de numéro de carte.',
        ],
      },
      {
        title: 'Support, emails et notifications',
        paragraphs: [
          'Le formulaire transmet par email le nom, l’adresse email, l’objet et le message ; aucune collection de base de données dédiée aux demandes de contact n’existe dans le code. Des emails opérationnels sont envoyés pour le compte, la sécurité, les inscriptions, sessions, progressions et certificats.',
          'Si les notifications Android sont activées, Firebase traite un identifiant de notification ; la plateforme conserve aussi la version de l’application et la dernière utilisation du terminal. Aucun abonnement marketing n’est présent dans le code.',
        ],
      },
      {
        title: 'Intelligence artificielle',
        paragraphs: [
          'Google Gemini traite les messages du concierge et du tuteur, leur contexte récent, ainsi que du contenu pédagogique lorsqu’un formateur génère des questions. Ne partagez aucun mot de passe, donnée bancaire ou information sensible avec un assistant IA.',
        ],
      },
      {
        title: 'Analytics et stockage local',
        paragraphs: [
          'Firebase Analytics est facultatif et ne fonctionne qu’après accord lorsqu’il est configuré. Les événements définis mesurent les écrans et les recommandations (formation, catégorie, rang), sans nom, email ni donnée de paiement.',
          'Le stockage sécurisé conserve le choix Analytics, une attribution de recommandation pouvant durer sept jours et le jeton de renouvellement.',
        ],
      },
      {
        title: 'Technique et prestataires',
        paragraphs: [
          'L’adresse IP sert à la limitation de débit et des informations de requête peuvent figurer dans les journaux. Les secrets, cookies et autorisations sont configurés pour y être masqués.',
          'Les prestataires identifiés sont Stripe, Google Gemini, Firebase, le fournisseur SMTP/email, MongoDB et l’hébergeur retenu. Leurs implantations, contrats et transferts internationaux doivent être vérifiés avant production.',
        ],
      },
      {
        title: 'Conservation et demandes',
        paragraphs: [
          'Les jetons de réinitialisation expirent et les sessions ont une durée configurée. Le code ne définit pas encore de durée globale de conservation ni de suppression automatisée du compte.',
          `Pour une demande concernant vos données, écrivez à ${supportEmail}. Les droits et délais applicables doivent être validés selon la juridiction.`,
        ],
      },
    ],
  },
  terms: {
    title: 'Conditions générales',
    intro:
      'Cadre d’utilisation de la plateforme, des formations et services payants.',
    sections: [
      {
        title: 'Compte et usage autorisé',
        paragraphs: [
          'Fournissez des informations exactes, protégez vos identifiants et signalez tout usage non autorisé. Ne contournez pas les contrôles d’accès et ne partagez pas les contenus auxquels vous n’avez pas droit. L’administration peut désactiver un compte.',
        ],
      },
      {
        title: 'Formations et disponibilité',
        paragraphs: [
          'Les contenus, critères, sessions et horaires sont ceux affichés dans la plateforme. Une formation peut être archivée et une session modifiée ou annulée. Les conséquences commerciales exactes restent à définir juridiquement.',
        ],
      },
      {
        title: 'Paiement et certificats',
        paragraphs: [
          'Stripe héberge le paiement. Seul l’état confirmé par le serveur déclenche l’inscription. La délivrance d’un certificat dépend des critères configurés ; elle ne constitue pas une qualification réglementée sauf indication distincte vérifiée.',
        ],
      },
      {
        title: 'Assistants IA',
        paragraphs: [
          'Les réponses Gemini peuvent être inexactes et ne remplacent pas les informations confirmées par l’équipe ou un formateur.',
        ],
      },
      {
        title: 'Clauses à finaliser',
        paragraphs: [
          'Les licences de contenu, limitations de responsabilité, droit applicable, juridiction et médiation ne sont pas affirmés faute d’informations vérifiées. Un professionnel du droit doit les rédiger avant production.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookies et traceurs',
    intro:
      'Transparence sur les stockages Web et Mobile utilisés par la plateforme.',
    sections: [
      {
        title: 'Web',
        paragraphs: [
          'Le Web utilise un cookie de session HttpOnly, SameSite=Lax et Secure en production. Le choix Analytics est enregistré dans localStorage et l’attribution de recommandation dans sessionStorage pour sept jours au plus.',
        ],
      },
      {
        title: 'Mobile',
        paragraphs: [
          'L’application ne repose pas sur des cookies de navigateur pour sa session. Elle utilise le stockage sécurisé pour le jeton de renouvellement, le choix Analytics et l’attribution de recommandation.',
        ],
      },
      {
        title: 'Analytics facultatif',
        paragraphs: [
          'Firebase Analytics ne fonctionne qu’après votre accord. Une fois connecté, vous pouvez modifier ce choix dans les paramètres de l’application.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Remboursements et annulations',
    intro:
      'Traitement actuel des paiements, sans inventer de délai ou droit commercial.',
    sections: [
      {
        title: 'Paiement non confirmé',
        paragraphs: [
          'Un paiement annulé, échoué ou en attente ne déclenche pas d’inscription. Consultez « Mes achats ». Si un débit apparaît sans accès, contactez le support sans transmettre de numéro de carte complet.',
        ],
      },
      {
        title: 'Faire une demande',
        paragraphs: [
          `Écrivez à ${supportEmail} depuis l’email du compte avec la formation et la date approximative. Le code ne contient pas de parcours ni d’API de remboursement : la demande nécessite une vérification manuelle.`,
        ],
      },
      {
        title: 'Règles à finaliser',
        paragraphs: [
          'High Skills Academy doit faire valider les délais, critères, formations commencées, sessions déplacées ou annulées, frais et délais de remboursement. Cette politique ne limite aucun droit impératif applicable.',
        ],
      },
    ],
  },
  deletion: {
    title: 'Suppression du compte et des données',
    intro: 'La suppression en libre-service n’est pas encore disponible.',
    sections: [
      {
        title: 'Envoyer une demande',
        paragraphs: [
          `Écrivez depuis l’adresse du compte à ${supportEmail} avec l’objet « Demande de suppression de compte » et vos prénom et nom. Ne transmettez ni mot de passe ni pièce bancaire. L’équipe devra vérifier votre identité avant toute action irréversible.`,
        ],
      },
      {
        title: 'Données concernées',
        paragraphs: [
          'La demande peut couvrir profil, sessions, notifications, inscriptions, progression, présence, évaluations et satisfaction. Certaines données peuvent devoir être conservées ou dissociées pour les obligations comptables, factures, certificats, preuve de formation ou prévention des abus.',
        ],
      },
      {
        title: 'Limite actuelle',
        paragraphs: [
          'Le code ne fixe ni workflow, ni délai, ni politique globale de conservation. Une procédure interne et des règles validées juridiquement sont requises avant production.',
        ],
      },
    ],
  },
};

export function LegalDocumentScreen({ kind }: { kind: LegalKind }) {
  const document = documents[kind];
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>VERSION DU 9 SEPTEMBRE 2026</Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.intro}>{document.intro}</Text>
        <View style={styles.review} accessibilityRole="alert">
          <Text style={styles.reviewText}>
            Projet fondé sur le fonctionnement actuel. Validation par un
            professionnel du droit requise avant production.
          </Text>
        </View>
        {document.sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
        {kind === 'cookies' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Votre choix actuel</Text>
            <AnalyticsPreferences />
          </View>
        )}
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`mailto:${supportEmail}`)}
        >
          <Text style={styles.link}>Contacter {supportEmail}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function GuestLegalScreen({
  route,
}: NativeStackScreenProps<GuestStackParamList, 'Legal'>) {
  return <LegalDocumentScreen kind={route.params.kind} />;
}

export function AppLegalScreen({
  route,
}: NativeStackScreenProps<AppStackParamList, 'Legal'>) {
  return <LegalDocumentScreen kind={route.params.kind} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.xl, paddingBottom: 72 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  intro: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  review: {
    borderWidth: 1,
    borderColor: '#e8d496',
    borderRadius: radii.sm,
    padding: spacing.lg,
    backgroundColor: '#fff9e7',
  },
  reviewText: { color: '#694c05', fontSize: 14, lineHeight: 21 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
