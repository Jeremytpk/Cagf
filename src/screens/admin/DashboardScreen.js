import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import StatTile from '../../components/StatTile';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography } from '../../theme/theme';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

export default function DashboardScreen() {
  const [employeeCount, setEmployeeCount] = useState(0);
  const [todayRecords, setTodayRecords] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployeeCount(snap.size);
    });

    const todayQuery = query(
      collection(db, 'attendance'),
      where('timestamp', '>=', startOfToday()),
      orderBy('timestamp', 'desc')
    );
    const unsubToday = onSnapshot(todayQuery, (snap) => {
      setTodayRecords(snap.docs.map((d) => d.data()));
    });

    const recentQuery = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(10));
    const unsubRecent = onSnapshot(recentQuery, (snap) => {
      setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubEmployees();
      unsubToday();
      unsubRecent();
    };
  }, []);

  const entriesToday = todayRecords.filter((r) => r.type === 'in').length;
  const exitsToday = todayRecords.filter((r) => r.type === 'out').length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        <View style={styles.statsRow}>
          <StatTile icon="people-outline" label="Employés" value={employeeCount} tint={colors.primary} tintBg={colors.primaryLight} />
          <StatTile icon="log-in-outline" label="Entrées aujourd'hui" value={entriesToday} tint={colors.accent} tintBg={colors.accentLight} />
        </View>
        <View style={styles.statsRow}>
          <StatTile icon="log-out-outline" label="Sorties aujourd'hui" value={exitsToday} tint={colors.warning} tintBg={colors.warningLight} />
          <StatTile icon="today-outline" label="Pointages aujourd'hui" value={todayRecords.length} tint={colors.primary} tintBg={colors.primaryLight} />
        </View>

        <Text style={styles.sectionTitle}>Activité récente</Text>
        {recentActivity.length === 0 ? (
          <EmptyState icon="pulse-outline" title="Aucune activité" subtitle="Les pointages récents apparaîtront ici." />
        ) : (
          <Card>
            {recentActivity.map((record, index) => (
              <View
                key={record.id}
                style={[styles.activityRow, index !== recentActivity.length - 1 && styles.activityRowBorder]}
              >
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: record.type === 'in' ? colors.accentLight : colors.warningLight },
                  ]}
                >
                  <Ionicons
                    name={record.type === 'in' ? 'log-in-outline' : 'log-out-outline'}
                    size={18}
                    color={record.type === 'in' ? colors.accent : colors.warning}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName}>{record.name || record.employeeId}</Text>
                  <Text style={styles.activityMeta}>
                    {record.type === 'in' ? 'Entrée' : 'Sortie'} ·{' '}
                    {record.timestamp?.toDate
                      ? record.timestamp.toDate().toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  activityName: { ...typography.body, fontWeight: '600' },
  activityMeta: { ...typography.caption },
});
