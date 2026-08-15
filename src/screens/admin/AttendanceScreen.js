import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import InputField from '../../components/InputField';
import EmptyState from '../../components/EmptyState';
import { colors, radius, shadow, spacing, typography } from '../../theme/theme';

const ATTENDANCE_COLUMNS = [
  { key: 'employeeId', label: 'Identifiant' },
  { key: 'name', label: 'Nom' },
  { key: 'type', label: 'Type' },
  { key: 'date', label: 'Date et heure' },
];

function dateLabel(date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return "Aujourd'hui";
  if (isYesterday) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function AttendanceScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(300));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter(
      (r) => r.name?.toLowerCase().includes(term) || r.employeeId?.toLowerCase().includes(term)
    );
  }, [records, search]);

  const sections = useMemo(() => {
    const groups = new Map();
    filtered.forEach((record) => {
      const date = record.timestamp?.toDate ? record.timestamp.toDate() : new Date();
      const key = date.toDateString();
      if (!groups.has(key)) groups.set(key, { title: dateLabel(date), data: [] });
      groups.get(key).data.push(record);
    });
    return Array.from(groups.values());
  }, [filtered]);

  const handleExport = () => {
    const rows = filtered.map((record) => ({
      employeeId: record.employeeId || '—',
      name: record.name || '—',
      type: record.type === 'in' ? 'Entrée' : 'Sortie',
      date: record.timestamp?.toDate
        ? record.timestamp.toDate().toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
    }));
    navigation.navigate('ReportPreview', {
      title: 'Rapport des présences',
      subtitle: 'Historique des entrées et sorties',
      columns: ATTENDANCE_COLUMNS,
      rows,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <InputField
          placeholder="Rechercher par nom ou identifiant…"
          value={search}
          onChangeText={setSearch}
          style={{ marginBottom: 0 }}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="time-outline" title="Aucun pointage" subtitle="L'historique des présences apparaîtra ici." />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View
              style={[
                styles.icon,
                { backgroundColor: item.type === 'in' ? colors.accentLight : colors.warningLight },
              ]}
            >
              <Ionicons
                name={item.type === 'in' ? 'log-in-outline' : 'log-out-outline'}
                size={18}
                color={item.type === 'in' ? colors.accent : colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || item.employeeId}</Text>
              <Text style={styles.meta}>{item.type === 'in' ? 'Entrée' : 'Sortie'}</Text>
            </View>
            <Text style={styles.time}>
              {item.timestamp?.toDate
                ? item.timestamp.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </Text>
          </View>
        )}
      />

      {filtered.length > 0 ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleExport}
          accessibilityLabel="Exporter les présences en PDF"
        >
          <Ionicons name="download-outline" size={26} color={colors.white} />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: {
    ...typography.caption,
    textTransform: 'capitalize',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
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
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  name: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption },
  time: { ...typography.caption, fontWeight: '600', color: colors.textPrimary },
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
