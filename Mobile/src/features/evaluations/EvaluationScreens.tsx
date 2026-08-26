import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatTunisDateTime } from '../../shared/utils/format';
import type { Enrollment, Page } from '../payments/types';
import type { PaginatedTrainings, Training } from '../trainings/types';
import type { Attempt, Evaluation, Question, ResultPage } from './types';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue.';
}

function evaluationStatus(status: Evaluation['status']): string {
  return { DRAFT: 'Brouillon', PUBLISHED: 'Publiée', ARCHIVED: 'Archivée' }[
    status
  ];
}

function OptionButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        selected && styles.optionSelected,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function AttemptView({
  attempt,
  busy,
  save,
  submit,
}: {
  attempt: Attempt;
  busy: boolean;
  save: (answer: Attempt['answers'][number], selected: string[]) => void;
  submit: () => void;
}) {
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);
  useEffect(() => {
    if (attempt.status !== 'IN_PROGRESS' || attempt.expiresAt === undefined)
      return;
    const timer = setInterval(
      () => setRemaining((value) => Math.max(0, (value ?? 0) - 1)),
      1_000,
    );
    return () => clearInterval(timer);
  }, [attempt.expiresAt, attempt.status]);
  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>
          Tentative {attempt.attemptNumber}
        </Text>
        <Text style={styles.status}>
          {attempt.status === 'IN_PROGRESS'
            ? 'En cours'
            : attempt.status === 'PASSED'
              ? 'Réussie'
              : 'Échouée'}
        </Text>
      </View>
      {remaining !== undefined && (
        <Text style={styles.timer}>
          Temps restant : {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </Text>
      )}
      {attempt.status !== 'IN_PROGRESS' && (
        <View style={styles.result}>
          <Text style={styles.score}>{attempt.scorePercentage ?? 0}%</Text>
          <Text style={styles.muted}>
            {attempt.answersRevealed
              ? 'Les réponses et explications sont disponibles.'
              : 'Les réponses restent masquées selon les règles de tentative.'}
          </Text>
        </View>
      )}
      {attempt.answers.map((answer, index) => (
        <View key={answer.questionId} style={styles.question}>
          <Text style={styles.questionTitle}>
            {index + 1}. {answer.question.prompt}
          </Text>
          <Text style={styles.muted}>{answer.question.points} point(s)</Text>
          {answer.question.options.map((option) => {
            const selected = answer.selectedOptionIds.includes(option.id);
            return (
              <OptionButton
                key={option.id}
                disabled={attempt.status !== 'IN_PROGRESS' || busy}
                label={option.text}
                selected={selected}
                onPress={() => {
                  const next =
                    answer.question.type === 'MULTIPLE_CHOICE'
                      ? selected
                        ? answer.selectedOptionIds.filter(
                            (id) => id !== option.id,
                          )
                        : [...answer.selectedOptionIds, option.id]
                      : [option.id];
                  save(answer, next);
                }}
              />
            );
          })}
          {attempt.answersRevealed &&
            answer.question.explanation !== undefined && (
              <Text style={styles.explanation}>
                {answer.question.explanation}
              </Text>
            )}
        </View>
      ))}
      {attempt.status === 'IN_PROGRESS' && (
        <Button
          label="Soumettre la tentative"
          loading={busy}
          onPress={submit}
        />
      )}
    </View>
  );
}

export function EvaluationsScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Evaluations'>) {
  const { user, request } = useAuth();
  const [page, setPage] = useState<Page<Evaluation> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Evaluation | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [results, setResults] = useState<ResultPage | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [questionType, setQuestionType] =
    useState<Question['type']>('SINGLE_CHOICE');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionOptions, setQuestionOptions] = useState('A | \nB | ');
  const [correctOptionIds, setCorrectOptionIds] = useState('A');
  const [questionExplanation, setQuestionExplanation] = useState('');
  const [questionPoints, setQuestionPoints] = useState('1');
  const [questionOrder, setQuestionOrder] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user === null) return;
    setError('');
    try {
      const view =
        user.role === 'LEARNER' ? 'ACCESSIBLE&status=PUBLISHED' : 'MANAGED';
      setPage(
        await request<Page<Evaluation>>(
          `/evaluations?view=${view}&page=${pageNumber}&pageSize=12`,
        ),
      );
      if (user.role === 'LEARNER') {
        setEnrollments(
          (await request<Page<Enrollment>>('/enrollments?pageSize=100')).items,
        );
      }
    } catch (caught) {
      setError(message(caught));
    }
  }, [pageNumber, request, user]);

  useEffect(() => {
    // Role and page select backend-authorized Evaluations.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function selectEvaluation(item: Evaluation) {
    if (user === null) return;
    setBusy(true);
    setError('');
    setNotice('');
    setResults(null);
    try {
      const detail = await request<Evaluation>(`/evaluations/${item.id}`);
      setSelected(detail);
      const current = detail.attempts?.find(
        ({ status }) => status === 'IN_PROGRESS',
      );
      if (
        user.role !== 'LEARNER' ||
        current !== undefined ||
        detail.completed
      ) {
        setAttempt(current ?? detail.attempts?.at(-1) ?? null);
        return;
      }
      const enrollment = enrollments.find(
        ({ training }) => training.id === detail.training.id,
      );
      if (enrollment === undefined)
        throw new Error(
          'Aucune inscription payée ne correspond à cette formation.',
        );
      setAttempt(
        await request<Attempt>(`/evaluations/${detail.id}/attempts`, {
          method: 'POST',
          body: JSON.stringify({ enrollmentId: enrollment.id }),
        }),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(
    answer: Attempt['answers'][number],
    selectedOptionIds: string[],
  ) {
    if (attempt === null) return;
    setBusy(true);
    setError('');
    try {
      setAttempt(
        await request<Attempt>(`/attempts/${attempt.id}/answers`, {
          method: 'PUT',
          body: JSON.stringify({
            questionId: answer.questionId,
            selectedOptionIds,
          }),
        }),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitAttempt() {
    if (attempt === null) return;
    setBusy(true);
    setError('');
    try {
      setAttempt(
        await request<Attempt>(`/attempts/${attempt.id}/submit`, {
          method: 'POST',
        }),
      );
      setNotice('Tentative corrigée par le backend.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function staffAction(path: string, success: string) {
    if (selected === null) return;
    setBusy(true);
    setError('');
    try {
      await request(path, { method: 'POST' });
      setSelected(await request<Evaluation>(`/evaluations/${selected.id}`));
      setNotice(success);
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function generateAi() {
    if (selected === null) return;
    setBusy(true);
    setError('');
    try {
      await request(`/evaluations/${selected.id}/generate-ai`, {
        method: 'POST',
        body: JSON.stringify({
          questionCount: 5,
          questionTypes: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'],
        }),
      });
      setSelected(await request<Evaluation>(`/evaluations/${selected.id}`));
      setNotice('Questions IA importées en brouillon pour révision.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function showResults() {
    if (selected === null) return;
    setBusy(true);
    try {
      setResults(
        await request<ResultPage>(`/evaluations/${selected.id}/results`),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function resetQuestionEditor() {
    setEditingQuestion(null);
    setQuestionEditorOpen(false);
    setQuestionType('SINGLE_CHOICE');
    setQuestionPrompt('');
    setQuestionOptions('A | \nB | ');
    setCorrectOptionIds('A');
    setQuestionExplanation('');
    setQuestionPoints('1');
    setQuestionOrder(String((selected?.questions?.length ?? 0) + 1));
  }

  function editQuestion(question: Question) {
    setEditingQuestion(question);
    setQuestionEditorOpen(true);
    setQuestionType(question.type);
    setQuestionPrompt(question.prompt);
    setQuestionOptions(
      question.options
        .map((option) => `${option.id} | ${option.text}`)
        .join('\n'),
    );
    setCorrectOptionIds(question.correctOptionIds?.join(', ') ?? '');
    setQuestionExplanation(question.explanation ?? '');
    setQuestionPoints(String(question.points));
    setQuestionOrder(String(question.order));
  }

  async function saveQuestion() {
    if (selected === null) return;
    const options = questionOptions
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('|');
        return separator < 0
          ? { id: '', text: '' }
          : {
              id: line.slice(0, separator).trim(),
              text: line.slice(separator + 1).trim(),
            };
      })
      .filter(({ id, text }) => id !== '' || text !== '');
    const correct = correctOptionIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const points = Number(questionPoints);
    const order = Number(questionOrder);
    if (
      questionPrompt.trim() === '' ||
      options.length < 2 ||
      options.some(
        ({ id, text }) => !/^[A-Za-z0-9_-]+$/.test(id) || text === '',
      ) ||
      correct.length === 0 ||
      correct.some((id) => !options.some((option) => option.id === id)) ||
      !Number.isInteger(points) ||
      points <= 0 ||
      !Number.isInteger(order) ||
      order <= 0
    ) {
      setError(
        'Vérifiez la question, ses options « ID | texte », les bonnes réponses, l’ordre et les points.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request(
        editingQuestion === null
          ? `/evaluations/${selected.id}/questions`
          : `/questions/${editingQuestion.id}`,
        {
          method: editingQuestion === null ? 'POST' : 'PUT',
          body: JSON.stringify({
            type: questionType,
            prompt: questionPrompt.trim(),
            options,
            correctOptionIds: correct,
            ...(questionExplanation.trim() === ''
              ? {}
              : { explanation: questionExplanation.trim() }),
            points,
            order,
          }),
        },
      );
      setSelected(await request<Evaluation>(`/evaluations/${selected.id}`));
      resetQuestionEditor();
      setNotice('Question enregistrée dans le brouillon.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function removeQuestion(question: Question) {
    if (selected === null) return;
    Alert.alert('Supprimer la question', question.prompt, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void request(`/questions/${question.id}`, { method: 'DELETE' })
            .then(async () => {
              setSelected(
                await request<Evaluation>(`/evaluations/${selected.id}`),
              );
              setNotice('Question supprimée.');
            })
            .catch((caught: unknown) => setError(message(caught)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  async function designateCertifying() {
    if (selected === null) return;
    setBusy(true);
    setError('');
    try {
      await request(
        `/trainings/${selected.training.id}/certifying-evaluation`,
        {
          method: 'PUT',
          body: JSON.stringify({
            evaluationId: selected.isCertifying ? null : selected.id,
          }),
        },
      );
      setSelected({ ...selected, isCertifying: !selected.isCertifying });
      setNotice(
        selected.isCertifying
          ? 'Évaluation certifiante retirée.'
          : 'Évaluation désignée comme certifiante.',
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>ÉVALUATION PÉDAGOGIQUE</Text>
            <Text style={styles.title}>
              {user?.role === 'ADMIN'
                ? 'Supervision des évaluations'
                : 'Mes évaluations'}
            </Text>
          </View>
          {user?.role === 'TRAINER' && (
            <View style={styles.smallAction}>
              <Button
                label="Créer"
                onPress={() => navigation.navigate('EvaluationCreate')}
              />
            </View>
          )}
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        {page === null && error === '' ? (
          <StatePanel loading message="Chargement des évaluations…" />
        ) : page?.items.length === 0 ? (
          <StatePanel
            title="Aucune évaluation"
            message="Les évaluations disponibles apparaîtront ici."
          />
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={styles.tabs}
            showsHorizontalScrollIndicator={false}
          >
            {page?.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void selectEvaluation(item)}
                style={[
                  styles.tab,
                  selected?.id === item.id && styles.tabSelected,
                ]}
              >
                <Text style={styles.tabTitle}>{item.title}</Text>
                <Text style={styles.muted}>{item.training.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {busy && selected === null && (
          <StatePanel loading message="Préparation de l’évaluation…" />
        )}
        {selected !== null && (
          <View style={styles.section}>
            <Text style={styles.status}>
              {evaluationStatus(selected.status)}
            </Text>
            <Text style={styles.sectionTitle}>{selected.title}</Text>
            <Text style={styles.muted}>
              {selected.training.title} · seuil {selected.passPercentage}% ·{' '}
              {selected.maxAttempts} tentative(s)
            </Text>
            {selected.instructions !== '' && (
              <Text style={styles.body}>{selected.instructions}</Text>
            )}
            {user?.role === 'LEARNER' && attempt !== null && (
              <AttemptView
                key={`${attempt.id}:${attempt.status}`}
                attempt={attempt}
                busy={busy}
                save={(answer, values) => void saveAnswer(answer, values)}
                submit={() => void submitAttempt()}
              />
            )}
            {user?.role !== 'LEARNER' && (
              <>
                {user?.role === 'TRAINER' && selected.status === 'DRAFT' && (
                  <Button
                    label="Générer 5 questions avec l’IA"
                    loading={busy}
                    onPress={() => void generateAi()}
                  />
                )}
                {user?.role === 'TRAINER' && selected.status === 'DRAFT' && (
                  <Button
                    label="Ajouter une question manuellement"
                    onPress={() => {
                      resetQuestionEditor();
                      setQuestionEditorOpen(true);
                    }}
                    variant="secondary"
                  />
                )}
                {user?.role === 'TRAINER' &&
                  selected.status === 'DRAFT' &&
                  questionEditorOpen && (
                    <View style={styles.editor}>
                      <Text style={styles.sectionTitle}>
                        {editingQuestion === null
                          ? 'Nouvelle question'
                          : 'Modifier la question'}
                      </Text>
                      <Text style={styles.label}>Type</Text>
                      {(
                        [
                          'SINGLE_CHOICE',
                          'MULTIPLE_CHOICE',
                          'TRUE_FALSE',
                        ] as const
                      ).map((value) => (
                        <OptionButton
                          key={value}
                          label={value}
                          selected={questionType === value}
                          onPress={() => {
                            setQuestionType(value);
                            if (value === 'TRUE_FALSE') {
                              setQuestionOptions('TRUE | Vrai\nFALSE | Faux');
                              setCorrectOptionIds('TRUE');
                            }
                          }}
                        />
                      ))}
                      <TextField
                        label="Question"
                        multiline
                        onChangeText={setQuestionPrompt}
                        value={questionPrompt}
                      />
                      <TextField
                        label="Options (une ligne ID | texte)"
                        multiline
                        onChangeText={setQuestionOptions}
                        value={questionOptions}
                      />
                      <TextField
                        label="IDs corrects (séparés par des virgules)"
                        onChangeText={setCorrectOptionIds}
                        value={correctOptionIds}
                      />
                      <TextField
                        label="Explication facultative"
                        multiline
                        onChangeText={setQuestionExplanation}
                        value={questionExplanation}
                      />
                      <TextField
                        inputMode="numeric"
                        label="Points"
                        onChangeText={setQuestionPoints}
                        value={questionPoints}
                      />
                      <TextField
                        inputMode="numeric"
                        label="Ordre"
                        onChangeText={setQuestionOrder}
                        value={questionOrder}
                      />
                      <Button
                        label="Enregistrer la question"
                        loading={busy}
                        onPress={() => void saveQuestion()}
                      />
                      <Button
                        label="Annuler"
                        onPress={resetQuestionEditor}
                        variant="secondary"
                      />
                    </View>
                  )}
                {user?.role === 'TRAINER' && selected.status === 'DRAFT' && (
                  <Button
                    label="Publier"
                    loading={busy}
                    onPress={() =>
                      void staffAction(
                        `/evaluations/${selected.id}/publish`,
                        'Évaluation publiée.',
                      )
                    }
                  />
                )}
                {user?.role === 'TRAINER' && selected.status !== 'ARCHIVED' && (
                  <Button
                    label={
                      selected.isCertifying
                        ? 'Retirer comme évaluation certifiante'
                        : 'Désigner comme évaluation certifiante'
                    }
                    loading={busy}
                    onPress={() => void designateCertifying()}
                    variant="secondary"
                  />
                )}
                {selected.status === 'PUBLISHED' && (
                  <Button
                    label="Consulter les résultats"
                    loading={busy}
                    onPress={() => void showResults()}
                    variant="secondary"
                  />
                )}
                {selected.status !== 'ARCHIVED' && (
                  <Button
                    label="Archiver"
                    loading={busy}
                    onPress={() =>
                      void staffAction(
                        `/evaluations/${selected.id}/archive`,
                        'Évaluation archivée.',
                      )
                    }
                    variant="danger"
                  />
                )}
                <View style={styles.questions}>
                  {selected.questions?.map((question: Question) => (
                    <View key={question.id} style={styles.question}>
                      <Text style={styles.questionTitle}>
                        {question.order}. {question.prompt}
                      </Text>
                      <Text style={styles.muted}>
                        {question.type} · {question.points} point(s)
                      </Text>
                      {question.options.map((option) => (
                        <Text key={option.id} style={styles.body}>
                          {option.id}. {option.text}
                        </Text>
                      ))}
                      {question.correctOptionIds !== undefined && (
                        <Text style={styles.explanation}>
                          Bonne(s) réponse(s) :{' '}
                          {question.correctOptionIds.join(', ')}
                        </Text>
                      )}
                      {user?.role === 'TRAINER' &&
                        selected.status === 'DRAFT' && (
                          <>
                            <Button
                              label="Modifier"
                              onPress={() => editQuestion(question)}
                              variant="secondary"
                            />
                            <Button
                              disabled={busy}
                              label="Supprimer"
                              onPress={() => removeQuestion(question)}
                              variant="danger"
                            />
                          </>
                        )}
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
        {results !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résultats</Text>
            <Text style={styles.muted}>
              {results.passedAttempts}/{results.totalAttempts} tentative(s)
              réussie(s)
            </Text>
            {results.items.map((result) => (
              <View key={result.id} style={styles.question}>
                <Text style={styles.questionTitle}>
                  {result.learner.firstName ?? result.learner.email}
                </Text>
                <Text style={styles.muted}>
                  {result.scorePercentage}% ·{' '}
                  {formatTunisDateTime(result.submittedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {page !== null && page.total > page.pageSize && (
          <View style={styles.pager}>
            <Button
              disabled={page.page <= 1}
              label="Précédent"
              onPress={() => setPageNumber((value) => value - 1)}
              variant="secondary"
            />
            <Button
              disabled={page.page * page.pageSize >= page.total}
              label="Suivant"
              onPress={() => setPageNumber((value) => value + 1)}
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function EvaluationCreateScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'EvaluationCreate'>) {
  const { request } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingId, setTrainingId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [passPercentage, setPassPercentage] = useState('70');
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void request<PaginatedTrainings>('/trainings?view=MANAGED&pageSize=100')
      .then((result) => setTrainings(result.items))
      .catch((caught: unknown) => setError(message(caught)));
  }, [request]);

  async function submit() {
    if (trainingId === '' || title.trim() === '')
      return setError('Sélectionnez une formation et saisissez un titre.');
    setBusy(true);
    setError('');
    try {
      await request('/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          trainingId,
          title: title.trim(),
          instructions: instructions.trim(),
          passPercentage: Number(passPercentage),
          maxAttempts: Number(maxAttempts),
          ...(durationMinutes.trim() === ''
            ? {}
            : { durationMinutes: Number(durationMinutes) }),
        }),
      });
      navigation.replace('Evaluations');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nouvelle évaluation</Text>
        <Text style={styles.label}>Formation</Text>
        {trainings.map((training) => (
          <OptionButton
            key={training.id}
            label={training.title}
            selected={trainingId === training.id}
            onPress={() => setTrainingId(training.id)}
          />
        ))}
        <TextField label="Titre" onChangeText={setTitle} value={title} />
        <TextField
          label="Instructions"
          multiline
          onChangeText={setInstructions}
          value={instructions}
        />
        <TextField
          keyboardType="number-pad"
          label="Seuil de réussite (%)"
          onChangeText={setPassPercentage}
          value={passPercentage}
        />
        <TextField
          keyboardType="number-pad"
          label="Nombre maximal de tentatives"
          onChangeText={setMaxAttempts}
          value={maxAttempts}
        />
        <TextField
          keyboardType="number-pad"
          label="Durée en minutes (optionnel)"
          onChangeText={setDurationMinutes}
          value={durationMinutes}
        />
        <Notice message={error} />
        <Button
          label="Créer le brouillon"
          loading={busy}
          onPress={() => void submit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 40 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 27, fontWeight: '700' },
  section: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 11,
    fontWeight: '700',
  },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  tabs: { gap: spacing.sm },
  tab: {
    width: 210,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  tabSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tabTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  question: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  questionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  questions: { gap: spacing.md },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.canvas,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: { color: colors.ink, fontSize: 14 },
  optionTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  disabled: { opacity: 0.65 },
  timer: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  result: {
    gap: spacing.sm,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  score: { color: colors.primaryDark, fontSize: 28, fontWeight: '800' },
  explanation: { color: colors.success, fontSize: 13, lineHeight: 20 },
  smallAction: { width: 90 },
  pager: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  editor: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.canvas,
  },
});
