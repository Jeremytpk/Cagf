import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import InputField from '../../components/InputField';
import EmptyState from '../../components/EmptyState';
import { colors, radius, spacing, typography, shadow } from '../../theme/theme';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatRange(startDate, endDate) {
  const format = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  return startDate === endDate ? format(startDate) : `${format(startDate)} → ${format(endDate)}`;
}

function statusFor(startDate, endDate) {
  const today = todayIso();
  if (today < startDate) return { label: 'À venir', bg: colors.primaryLight, color: colors.primary };
  if (today > endDate) return { label: 'Terminé', bg: colors.border, color: colors.textSecondary };
  return { label: 'En cours', bg: colors.accentLight, color: colors.accent };
}

export default function VacationsListScreen({ navigation }) {
  const [vacations, setVacations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'vacations'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setVacations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vacations;
    return vacations.filter(
      (v) => v.employeeName?.toLowerCase().includes(term) || v.employeeId?.toLowerCase().includes(term)
    );
  }, [vacations, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <InputField placeholder="Rechercher un employé…" value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="calendar-outline"
              title="Aucun congé"
              subtitle="Ajoutez un congé avec le bouton +"
            />
          ) : null
        }
        renderItem={({ item }) => {
          const status = statusFor(item.startDate, item.endDate);
          return (
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EditVacation', { vacation: item })}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.employeeName}</Text>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{formatRange(item.startDate, item.endDate)}</Text>
                {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddVacation')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typography.body, fontWeight: '600', flexShrink: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.sm },
  badgeText: { fontSize: 12, fontWeight: '700' },
  meta: { ...typography.caption, marginTop: spacing.xs },
  reason: { ...typography.caption, marginTop: 2, fontStyle: 'italic' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
});
