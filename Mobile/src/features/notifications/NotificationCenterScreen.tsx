import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { openBackendLink } from '../../app/navigation/backend-link';
import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { useNotifications } from '../../core/notifications/NotificationProvider';
import { Button } from '../../shared/components/Button';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type { NotificationItem, NotificationPage } from './types';

type StateFilter = 'ALL' | 'UNREAD' | 'READ';

const filterLabels: Record<StateFilter, string> = {
  ALL: 'Toutes',
  UNREAD: 'Non lues',
  READ: 'Lues',
};

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Impossible de charger les notifications.';
}

export function NotificationCenterScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Notifications'>) {
  const navigate = navigation.navigate as unknown as (
    name: keyof AppStackParamList,
    params?: object,
  ) => void;
  const { request } = useAuth();
  const { refreshUnread } = useNotifications();
  const [filter, setFilter] = useState<StateFilter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await request<NotificationPage>(
        `/notifications?page=${page}&pageSize=20&state=${filter}`,
      );
      setData(next);
      await refreshUnread();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [filter, page, refreshUnread, request]);

  useEffect(() => {
    // Synchronize the list with server-owned pagination and filter state.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function markRead(item: NotificationItem) {
    if (!item.read) {
      await request(`/notifications/${item.id}/read`, { method: 'PATCH' });
      await load();
    }
    if (item.link)
      openBackendLink(
        navigate,
        item.link,
      );
  }

  async function markAllRead() {
    setError('');
    try {
      await request('/notifications/read-all', { method: 'PATCH' });
      await load();
    } catch (caught) {
      setError(message(caught));
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
    >
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>MON ESPACE</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.muted}>
            Les événements importants liés à vos formations et à votre compte.
          </Text>
        </View>
        {(data?.unread ?? 0) > 0 && (
          <Button
            label="Tout marquer comme lu"
            onPress={() => void markAllRead()}
            variant="secondary"
          />
        )}
      </View>
      <View accessibilityRole="radiogroup" style={styles.filters}>
        {(Object.keys(filterLabels) as StateFilter[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: filter === value }}
            onPress={() => {
              setFilter(value);
              setPage(1);
            }}
            style={[styles.filter, filter === value && styles.filterActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.filterTextActive,
              ]}
            >
              {filterLabels[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      {data === null && loading ? (
        <StatePanel loading message="Chargement des notifications…" />
      ) : error !== '' ? (
        <StatePanel
          title="Chargement impossible"
          message={error}
          retry={() => void load()}
        />
      ) : data?.items.length === 0 ? (
        <StatePanel
          title="Aucune notification"
          message="Aucune notification ne correspond à ce filtre."
        />
      ) : (
        <View style={styles.list}>
          {data?.items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() =>
                void markRead(item).catch((caught: unknown) =>
                  setError(message(caught)),
                )
              }
              style={({ pressed }) => [
                styles.item,
                !item.read && styles.unread,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.dot, item.read && styles.dotRead]} />
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemBody}>{item.message}</Text>
                <Text style={styles.time}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.timestamp))}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {data !== null && data.total > data.pageSize && (
        <View style={styles.pager}>
          <Button
            disabled={page <= 1 || loading}
            label="Précédent"
            onPress={() => setPage((value) => value - 1)}
            variant="secondary"
          />
          <Text style={styles.muted}>Page {page}</Text>
          <Button
            disabled={page * data.pageSize >= data.total || loading}
            label="Suivant"
            onPress={() => setPage((value) => value + 1)}
            variant="secondary"
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  filterActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterText: { color: colors.muted, fontWeight: '700' },
  filterTextActive: { color: colors.primaryDark },
  list: { gap: spacing.sm },
  item: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  unread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.72 },
  dot: {
    width: 9,
    height: 9,
    marginTop: 6,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  dotRead: { backgroundColor: colors.line },
  itemTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  itemBody: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 11 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
