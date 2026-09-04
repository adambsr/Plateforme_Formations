import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GuestStackParamList } from '../../app/navigation/types';
import { ApiError, apiAssetUrl, apiClient } from '../../core/api/client';
import { Brand } from '../../shared/components/Brand';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { ScrollToTopButton } from '../../shared/components/ScrollToTopButton';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatDuration, formatEur } from '../trainings/format';
import { trainingApi } from '../trainings/training-api';
import type { Training, TrainingCategory } from '../trainings/types';
import { useAuth } from '../../core/auth/AuthContext';

const centerAddress =
  process.env.EXPO_PUBLIC_CENTER_ADDRESS ??
  'Route Manzel Chaker km 2.5 en face Magasin Général (MG), Sfax, Tunisia';
const centerEmail =
  process.env.EXPO_PUBLIC_CENTER_EMAIL ?? 'highskills.ac@gmail.com';
const centerPhone = process.env.EXPO_PUBLIC_CENTER_PHONE ?? '+216 70 000 000';
const centerHours =
  process.env.EXPO_PUBLIC_CENTER_HOURS ?? 'Lundi–vendredi, 8 h 30–17 h 30';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

export function HomeScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Home'>) {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [trainings, setTrainings] = useState<Training[]>();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [page, availableCategories] = await Promise.all([
        trainingApi.listTrainings({ page: 1, pageSize: 3 }),
        trainingApi.listCategories(),
      ]);
      setTrainings(page.items);
      setCategories(availableCategories.slice(0, 5));
    } catch {
      setTrainings([]);
      setCategories([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(event) =>
          setShowScrollTop(event.nativeEvent.contentOffset.y > 360)
        }
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load()}
          />
        }
      >
        <Brand />
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            APPRENDRE. PROGRESSER. RÉUSSIR.
          </Text>
          <Text style={styles.heroTitle}>
            La formation qui avance avec vous.
          </Text>
          <Text style={styles.heroText}>
            Découvrez des parcours professionnels en ligne ou en présentiel,
            suivez votre progression et valorisez vos acquis par un certificat.
          </Text>
          <Button
            label="Explorer les formations"
            onPress={() => navigation.navigate('Catalogue')}
          />
          {user === null ? (
            <Button
              label="Créer mon compte"
              variant="secondary"
              onPress={() => navigation.navigate('Register')}
            />
          ) : (
            <Button
              label="Retour au tableau de bord"
              variant="secondary"
              onPress={() => navigation.navigate('Workspace' as never)}
            />
          )}
          <View style={styles.proofRow}>
            <Proof title="2 modalités" text="En ligne et présentiel" />
            <Proof title="Suivi clair" text="Progression et planning" />
            <Proof title="Certificats" text="Après validation" />
          </View>
        </View>

        <SectionTitle
          eyebrow="UNE EXPÉRIENCE COMPLÈTE"
          title="Tout pour transformer une inscription en compétences."
        />
        <Feature
          title="Parcours structurés"
          text="Modules, leçons et ressources organisés pour avancer sans perdre le fil."
        />
        <Feature
          title="Sessions maîtrisées"
          text="Dates, salles, formateurs et présences réunis dans un planning lisible."
        />
        <Feature
          title="Résultats vérifiables"
          text="Évaluations, progression et certificats reposent sur des règles transparentes."
        />

        <SectionTitle eyebrow="DOMAINES" title="Explorez par catégorie" />
        <View style={styles.chips}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              style={styles.chip}
              onPress={() => navigation.navigate('Catalogue')}
            >
              <Text style={styles.chipText}>{category.name}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle eyebrow="À DÉCOUVRIR" title="Formations publiées" />
        {trainings === undefined ? (
          <StatePanel loading message="Chargement des formations…" />
        ) : trainings.length === 0 ? (
          <StatePanel
            title="De nouveaux parcours arrivent bientôt."
            message="Consultez le catalogue pour voir les publications."
          />
        ) : (
          trainings.map((training) => (
            <Pressable
              accessibilityRole="button"
              key={training.id}
              onPress={() =>
                navigation.navigate('TrainingDetail', {
                  trainingId: training.id,
                })
              }
              style={styles.card}
            >
              <HomeTrainingThumbnail training={training} />
              <Text style={styles.cardMeta}>{training.category.name}</Text>
              <Text style={styles.cardTitle}>{training.title}</Text>
              <Text style={styles.body}>{training.description}</Text>
              <Text style={styles.cardMeta}>
                {formatDuration(training.durationMinutes)} ·{' '}
                {formatEur(training.priceMinor)}
              </Text>
            </Pressable>
          ))
        )}
        <Button
          label="Voir tout le catalogue"
          variant="secondary"
          onPress={() => navigation.navigate('Catalogue')}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Un parcours simple, du choix au certificat.
          </Text>
          <Text style={styles.body}>1. Choisissez une formation publiée.</Text>
          <Text style={styles.body}>2. Créez votre compte Apprenant.</Text>
          <Text style={styles.body}>
            3. Progressez dans le contenu ou le planning.
          </Text>
          <Text style={styles.body}>4. Validez les étapes requises.</Text>
        </View>
        <View style={styles.navigationCard}>
          <Button
            label="À propos"
            variant="link"
            onPress={() => navigation.navigate('About')}
          />
          <Button
            label="Questions fréquentes"
            variant="link"
            onPress={() => navigation.navigate('Faq')}
          />
          <Button
            label="Nous contacter"
            variant="link"
            onPress={() => navigation.navigate('Contact')}
          />
          {user === null && (
            <Button
              label="Se connecter"
              variant="link"
              onPress={() => navigation.navigate('Login')}
            />
          )}
        </View>
      </ScrollView>
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

function HomeTrainingThumbnail({ training }: { training: Training }) {
  const [failed, setFailed] = useState(false);
  if (training.thumbnailUrl === undefined || failed) {
    return (
      <View style={styles.homeThumbnailFallback}>
        <Text style={styles.homeThumbnailFallbackText}>HSA</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={`Training thumbnail for ${training.title}`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: apiAssetUrl(training.thumbnailUrl) }}
      style={styles.homeThumbnail}
    />
  );
}

function Proof({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.proof}>
      <Text style={styles.proofTitle}>{title}</Text>
      <Text style={styles.proofText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export function AboutScreen() {
  return (
    <PublicPage
      eyebrow="À PROPOS"
      title="La formation professionnelle, rendue plus lisible."
    >
      <View style={styles.aboutBrand}>
        <Brand />
      </View>
      <Text style={styles.lead}>
        La plateforme accompagne un centre de formation dans la diffusion de
        parcours en ligne et l’organisation de sessions en présentiel.
      </Text>
      <Feature
        title="Pour les Apprenants"
        text="Un seul espace pour apprendre, consulter son planning, passer ses évaluations et retrouver ses documents."
      />
      <Feature
        title="Pour les Formateurs"
        text="Des outils concentrés sur le contenu pédagogique, les sessions, les présences et les résultats."
      />
      <Feature
        title="Pour le centre"
        text="Une vision cohérente des utilisateurs, formations, inscriptions et indicateurs d’activité."
      />
    </PublicPage>
  );
}

const questions = [
  [
    'Puis-je créer un compte Formateur ?',
    'Non. Les comptes Formateurs sont créés exclusivement par l’Admin du centre.',
  ],
  [
    'Quelle différence entre en ligne et présentiel ?',
    'La formation en ligne se suit à votre rythme. En présentiel, vous choisissez une session avec des dates et un lieu.',
  ],
  [
    'Quand puis-je obtenir mon certificat ?',
    'Après avoir satisfait les conditions de progression, de présence et d’évaluation applicables.',
  ],
  [
    'Le paiement est-il confirmé par l’application ?',
    'La confirmation provient du prestataire et du backend sécurisé, jamais du simple retour du navigateur.',
  ],
] as const;

export function FaqScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Faq'>) {
  const [open, setOpen] = useState<string>(questions[0][0]);
  return (
    <PublicPage
      eyebrow="QUESTIONS FRÉQUENTES"
      title="Les réponses avant de commencer."
    >
      {questions.map(([question, answer]) => (
        <Pressable
          key={question}
          style={styles.card}
          onPress={() =>
            setOpen((current) => (current === question ? '' : question))
          }
        >
          <Text style={styles.cardTitle}>{question}</Text>
          {open === question && <Text style={styles.body}>{answer}</Text>}
        </Pressable>
      ))}
      <Button
        label="Nous contacter"
        onPress={() => navigation.navigate('Contact')}
      />
    </PublicPage>
  );
}

export function ContactScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Contact'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    if (
      name.trim().length < 2 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      subject.trim().length < 3 ||
      body.trim().length < 10
    ) {
      setError(
        'Vérifiez tous les champs : le message doit contenir au moins 10 caractères.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiClient.request<{ message: string }>('/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: body.trim(),
        }),
      });
      setNotice(result.message);
      setName('');
      setEmail('');
      setSubject('');
      setBody('');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicPage eyebrow="CONTACT" title="Parlons de votre projet de formation.">
      <Text style={styles.lead}>
        Notre équipe vous répond sans jamais demander de mot de passe ni de
        données de carte.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coordonnées</Text>
        <Text style={styles.body}>{centerAddress}</Text>
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${centerEmail}`)}
        >
          <Text style={styles.link}>{centerEmail}</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            void Linking.openURL(`tel:${centerPhone.replace(/\s/g, '')}`)
          }
        >
          <Text style={styles.link}>{centerPhone}</Text>
        </Pressable>
        <Text style={styles.body}>{centerHours}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Envoyer un message</Text>
        <TextField label="Nom" value={name} onChangeText={setName} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField label="Objet" value={subject} onChangeText={setSubject} />
        <TextField
          label="Message"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Notice message={error} />
        <Notice message={notice} success />
        <Button
          label="Envoyer le message"
          loading={busy}
          onPress={() => void submit()}
        />
      </View>
      <Button
        label="Consulter le catalogue"
        variant="secondary"
        onPress={() => navigation.navigate('Catalogue')}
      />
    </PublicPage>
  );
}

function PublicPage({
  eyebrow,
  title,
  children,
}: React.PropsWithChildren<{ eyebrow: string; title: string }>) {
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onScroll={(event) =>
          setShowScrollTop(event.nativeEvent.contentOffset.y > 280)
        }
        scrollEventThrottle={16}
      >
        <SectionTitle eyebrow={eyebrow} title={title} />
        {children}
      </ScrollView>
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.xl, paddingBottom: 72 },
  hero: {
    gap: spacing.lg,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.primaryDark,
  },
  heroEyebrow: {
    color: '#bcd8f5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  heroText: { color: '#dbe7f5', fontSize: 16, lineHeight: 24 },
  proofRow: { gap: spacing.sm },
  proof: {
    borderTopWidth: 1,
    borderTopColor: '#47709f',
    paddingTop: spacing.sm,
  },
  proofTitle: { color: colors.surface, fontWeight: '800' },
  proofText: { color: '#dbe7f5', fontSize: 13 },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  lead: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  homeThumbnail: { width: '100%', height: 156, borderRadius: radii.sm },
  homeThumbnailFallback: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  homeThumbnailFallbackText: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
  },
  aboutBrand: { alignItems: 'center', paddingVertical: spacing.md },
  navigationCard: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
  },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  cardMeta: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  chipText: { color: colors.primaryDark, fontWeight: '700' },
});
