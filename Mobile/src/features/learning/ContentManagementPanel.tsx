import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Archive, BookPlus, Edit3, Trash2 } from 'lucide-react-native';

import { ApiError } from '../../core/api/client';
import type { AuthContextValue } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type { ResourceType, TrainingContent } from './types';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

type ModuleDraft = {
  id?: string;
  title: string;
  description: string;
  order: string;
};
type LessonDraft = {
  moduleId: string;
  id?: string;
  title: string;
  description: string;
  textContent: string;
  instructions: string;
  order: string;
};
type ResourceDraft = {
  lessonId: string;
  title: string;
  description: string;
  order: string;
  type: ResourceType;
  externalUrl: string;
  isVisibleToLearners: boolean;
  file?: DocumentPicker.DocumentPickerAsset;
};

const emptyModule = (order: number): ModuleDraft => ({
  title: '',
  description: '',
  order: String(order),
});
const emptyLesson = (moduleId: string, order: number): LessonDraft => ({
  moduleId,
  title: '',
  description: '',
  textContent: '',
  instructions: '',
  order: String(order),
});
const emptyResource = (lessonId: string, order: number): ResourceDraft => ({
  lessonId,
  title: '',
  description: '',
  order: String(order),
  type: 'EXTERNAL_URL',
  externalUrl: '',
  isVisibleToLearners: true,
});

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ContentManagementPanel({
  content,
  request,
  reload,
}: {
  content: TrainingContent;
  request: AuthContextValue['request'];
  reload: () => Promise<void>;
}) {
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft>();
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>();
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await reload();
      setNotice(success);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveModule() {
    if (moduleDraft === undefined) return;
    const order = Number(moduleDraft.order);
    if (
      moduleDraft.title.trim() === '' ||
      !Number.isInteger(order) ||
      order <= 0
    ) {
      setError('Renseignez le titre et un ordre positif pour le module.');
      return;
    }
    const draft = moduleDraft;
    await run(async () => {
      await request(
        draft.id === undefined
          ? `/trainings/${content.trainingId}/modules`
          : `/modules/${draft.id}`,
        {
          method: draft.id === undefined ? 'POST' : 'PUT',
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description.trim(),
            order,
          }),
        },
      );
      setModuleDraft(undefined);
    }, 'Module enregistré.');
  }

  async function saveLesson() {
    if (lessonDraft === undefined) return;
    const order = Number(lessonDraft.order);
    if (
      lessonDraft.title.trim() === '' ||
      !Number.isInteger(order) ||
      order <= 0
    ) {
      setError('Renseignez le titre et un ordre positif pour la leçon.');
      return;
    }
    const draft = lessonDraft;
    await run(async () => {
      await request(
        draft.id === undefined
          ? `/modules/${draft.moduleId}/lessons`
          : `/lessons/${draft.id}`,
        {
          method: draft.id === undefined ? 'POST' : 'PUT',
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description.trim(),
            textContent: draft.textContent,
            instructions: draft.instructions,
            order,
          }),
        },
      );
      setLessonDraft(undefined);
    }, 'Leçon enregistrée.');
  }

  async function chooseFile() {
    if (resourceDraft === undefined) return;
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0] !== undefined) {
      setResourceDraft({ ...resourceDraft, file: result.assets[0] });
    }
  }

  async function saveResource() {
    if (resourceDraft === undefined) return;
    const order = Number(resourceDraft.order);
    if (
      resourceDraft.title.trim() === '' ||
      !Number.isInteger(order) ||
      order <= 0 ||
      (resourceDraft.type === 'EXTERNAL_URL' &&
        !/^https?:\/\//i.test(resourceDraft.externalUrl)) ||
      (resourceDraft.type === 'FILE' && resourceDraft.file === undefined)
    ) {
      setError(
        'Renseignez le titre, l’ordre et une URL HTTP(S) ou un fichier.',
      );
      return;
    }
    const draft = resourceDraft;
    await run(async () => {
      if (draft.type === 'EXTERNAL_URL') {
        await request(`/lessons/${draft.lessonId}/resources`, {
          method: 'POST',
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description.trim(),
            order,
            type: draft.type,
            isVisibleToLearners: draft.isVisibleToLearners,
            externalUrl: draft.externalUrl.trim(),
          }),
        });
      } else if (draft.file !== undefined) {
        const body = new FormData();
        body.append('title', draft.title.trim());
        body.append('description', draft.description.trim());
        body.append('order', String(order));
        body.append('type', 'FILE');
        body.append('isVisibleToLearners', String(draft.isVisibleToLearners));
        body.append('file', {
          uri: draft.file.uri,
          name: draft.file.name,
          type: draft.file.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
        await request(`/lessons/${draft.lessonId}/resources`, {
          method: 'POST',
          body,
        });
      }
      setResourceDraft(undefined);
    }, 'Ressource ajoutée.');
  }

  function archive(path: string, isArchived: boolean, label: string) {
    void run(
      () =>
        request(path, {
          method: 'PUT',
          body: JSON.stringify({ isArchived: !isArchived }),
        }),
      `${label} ${isArchived ? 'restauré' : 'archivé'}.`,
    );
  }

  function remove(path: string, label: string) {
    Alert.alert(
      `Supprimer ${label}`,
      'Cette suppression peut être refusée si des données historiques en dépendent.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            void run(
              () => request(path, { method: 'DELETE' }),
              `${label} supprimé.`,
            ),
        },
      ],
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Gestion pédagogique</Text>
      <Text style={styles.muted}>
        Les modifications restent soumises aux droits de propriétaire contrôlés
        par le backend.
      </Text>
      <Notice message={error} />
      <Notice message={notice} success />
      {moduleDraft === undefined ? (
        <Button
          label="Ajouter un module"
          onPress={() =>
            setModuleDraft(emptyModule(content.modules.length + 1))
          }
        />
      ) : (
        <View style={styles.editor}>
          <Text style={styles.subtitle}>
            {moduleDraft.id === undefined
              ? 'Nouveau module'
              : 'Modifier le module'}
          </Text>
          <TextField
            label="Titre"
            onChangeText={(title) => setModuleDraft({ ...moduleDraft, title })}
            value={moduleDraft.title}
          />
          <TextField
            label="Description"
            multiline
            onChangeText={(description) =>
              setModuleDraft({ ...moduleDraft, description })
            }
            value={moduleDraft.description}
          />
          <TextField
            inputMode="numeric"
            label="Ordre"
            onChangeText={(order) => setModuleDraft({ ...moduleDraft, order })}
            value={moduleDraft.order}
          />
          <Button
            label="Enregistrer le module"
            loading={busy}
            onPress={() => void saveModule()}
          />
          <Button
            label="Annuler"
            onPress={() => setModuleDraft(undefined)}
            variant="secondary"
          />
        </View>
      )}
      {content.modules.map((module) => (
        <View key={module.id} style={styles.entity}>
          <Text style={styles.subtitle}>
            {module.order}. {module.title}
          </Text>
          <Text style={styles.muted}>
            {module.isArchived ? 'Archivé' : 'Actif'}
          </Text>
          <Button
            label="Modifier le module"
              icon={Edit3}
            onPress={() =>
              setModuleDraft({
                id: module.id,
                title: module.title,
                description: module.description,
                order: String(module.order),
              })
            }
            variant="secondary"
          />
          <Button
            label={
              module.isArchived ? 'Restaurer le module' : 'Archiver le module'
            }
            icon={Archive}
            disabled={busy}
            onPress={() =>
              archive(`/modules/${module.id}`, module.isArchived, 'Module')
            }
            variant="secondary"
          />
          <Button
            label="Supprimer le module"
            icon={Trash2}
            disabled={busy}
            onPress={() => remove(`/modules/${module.id}`, 'le module')}
            variant="danger"
          />
          {lessonDraft?.moduleId === module.id ? (
            <LessonEditor
              draft={lessonDraft}
              setDraft={setLessonDraft}
              busy={busy}
              save={() => void saveLesson()}
            />
          ) : (
            <Button
              label="Ajouter une leçon"
              icon={BookPlus}
              onPress={() =>
                setLessonDraft(
                  emptyLesson(module.id, module.lessons.length + 1),
                )
              }
              variant="secondary"
            />
          )}
          {module.lessons.map((lesson) => (
            <View key={lesson.id} style={styles.nested}>
              <Text style={styles.rowTitle}>
                {lesson.order}. {lesson.title}
              </Text>
              <Text style={styles.muted}>
                {lesson.isArchived ? 'Archivée' : 'Active'} ·{' '}
                {lesson.resources.length} ressource(s)
              </Text>
              <Button
                label="Modifier la leçon"
                icon={Edit3}
                onPress={() =>
                  setLessonDraft({
                    moduleId: module.id,
                    id: lesson.id,
                    title: lesson.title,
                    description: lesson.description,
                    textContent: lesson.textContent,
                    instructions: lesson.instructions,
                    order: String(lesson.order),
                  })
                }
                variant="secondary"
              />
              <Button
                label={
                  lesson.isArchived ? 'Restaurer la leçon' : 'Archiver la leçon'
                }
                disabled={busy}
                icon={Archive}
                onPress={() =>
                  archive(`/lessons/${lesson.id}`, lesson.isArchived, 'Leçon')
                }
                variant="secondary"
              />
              <Button
                label="Supprimer la leçon"
                icon={Trash2}
                disabled={busy}
                onPress={() => remove(`/lessons/${lesson.id}`, 'la leçon')}
                variant="danger"
              />
              {resourceDraft?.lessonId === lesson.id ? (
                <ResourceEditor
                  draft={resourceDraft}
                  setDraft={setResourceDraft}
                  busy={busy}
                  chooseFile={() => void chooseFile()}
                  save={() => void saveResource()}
                />
              ) : (
                <Button
                  label="Ajouter une ressource"
                  onPress={() =>
                    setResourceDraft(
                      emptyResource(lesson.id, lesson.resources.length + 1),
                    )
                  }
                  variant="secondary"
                />
              )}
              {lesson.resources.map((resource) => (
                <View key={resource.id} style={styles.resourceRow}>
                  <Text style={styles.rowTitle}>{resource.title}</Text>
                  <Text style={styles.muted}>
                    {resource.type} ·{' '}
                    {resource.isVisibleToLearners ? 'Visible' : 'Masquée'} ·{' '}
                    {resource.isArchived ? 'Archivée' : 'Active'}
                  </Text>
                  <Button
                    label={resource.isArchived ? 'Restaurer' : 'Archiver'}
                    disabled={busy}
                    onPress={() =>
                      archive(
                        `/resources/${resource.id}`,
                        resource.isArchived,
                        'Ressource',
                      )
                    }
                    variant="secondary"
                  />
                  <Button
                    label="Supprimer"
                    disabled={busy}
                    onPress={() =>
                      remove(`/resources/${resource.id}`, 'la ressource')
                    }
                    variant="danger"
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function LessonEditor({
  draft,
  setDraft,
  busy,
  save,
}: {
  draft: LessonDraft;
  setDraft: (value: LessonDraft | undefined) => void;
  busy: boolean;
  save: () => void;
}) {
  return (
    <View style={styles.editor}>
      <Text style={styles.subtitle}>
        {draft.id === undefined ? 'Nouvelle leçon' : 'Modifier la leçon'}
      </Text>
      <TextField
        label="Titre"
        onChangeText={(title) => setDraft({ ...draft, title })}
        value={draft.title}
      />
      <TextField
        label="Description"
        multiline
        onChangeText={(description) => setDraft({ ...draft, description })}
        value={draft.description}
      />
      <TextField
        label="Contenu texte"
        multiline
        onChangeText={(textContent) => setDraft({ ...draft, textContent })}
        value={draft.textContent}
      />
      <TextField
        label="Instructions"
        multiline
        onChangeText={(instructions) => setDraft({ ...draft, instructions })}
        value={draft.instructions}
      />
      <TextField
        inputMode="numeric"
        label="Ordre"
        onChangeText={(order) => setDraft({ ...draft, order })}
        value={draft.order}
      />
      <Button label="Enregistrer la leçon" loading={busy} onPress={save} />
      <Button
        label="Annuler"
        onPress={() => setDraft(undefined)}
        variant="secondary"
      />
    </View>
  );
}

function ResourceEditor({
  draft,
  setDraft,
  busy,
  chooseFile,
  save,
}: {
  draft: ResourceDraft;
  setDraft: (value: ResourceDraft | undefined) => void;
  busy: boolean;
  chooseFile: () => void;
  save: () => void;
}) {
  return (
    <View style={styles.editor}>
      <Text style={styles.subtitle}>Nouvelle ressource</Text>
      <TextField
        label="Titre"
        onChangeText={(title) => setDraft({ ...draft, title })}
        value={draft.title}
      />
      <TextField
        label="Description"
        multiline
        onChangeText={(description) => setDraft({ ...draft, description })}
        value={draft.description}
      />
      <TextField
        inputMode="numeric"
        label="Ordre"
        onChangeText={(order) => setDraft({ ...draft, order })}
        value={draft.order}
      />
      <View style={styles.choiceRow}>
        <Choice
          label="Lien externe"
          onPress={() =>
            setDraft({ ...draft, type: 'EXTERNAL_URL', file: undefined })
          }
          selected={draft.type === 'EXTERNAL_URL'}
        />
        <Choice
          label="Fichier"
          onPress={() => setDraft({ ...draft, type: 'FILE', externalUrl: '' })}
          selected={draft.type === 'FILE'}
        />
      </View>
      {draft.type === 'EXTERNAL_URL' ? (
        <TextField
          autoCapitalize="none"
          inputMode="url"
          label="URL HTTP(S)"
          onChangeText={(externalUrl) => setDraft({ ...draft, externalUrl })}
          value={draft.externalUrl}
        />
      ) : (
        <>
          <Button
            label={
              draft.file === undefined
                ? 'Choisir un fichier'
                : 'Remplacer le fichier'
            }
            onPress={chooseFile}
            variant="secondary"
          />
          {draft.file !== undefined && (
            <Text style={styles.muted}>{draft.file.name}</Text>
          )}
        </>
      )}
      <Choice
        label="Visible aux apprenants"
        onPress={() =>
          setDraft({
            ...draft,
            isVisibleToLearners: !draft.isVisibleToLearners,
          })
        }
        selected={draft.isVisibleToLearners}
      />
      <Button label="Ajouter la ressource" loading={busy} onPress={save} />
      <Button
        label="Annuler"
        onPress={() => setDraft(undefined)}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  subtitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  editor: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  entity: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primary,
    paddingTop: spacing.lg,
  },
  nested: {
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.line,
    paddingLeft: spacing.md,
  },
  resourceRow: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: { color: colors.ink, fontWeight: '600' },
  choiceTextSelected: { color: colors.primaryDark },
});
