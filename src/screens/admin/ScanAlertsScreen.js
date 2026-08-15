import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import EmptyState from '../../components/EmptyState';
import { colors, radius, shadow, spacing, typography } from '../../theme/theme';

const ALERT_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'employee', label: 'Employé' },
  { key: 'similarity', label: 'Ressemblance' },
  { key: 'date', label: 'Date' },
];

export default function ScanAlertsScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'scanAlerts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleExport = () => {
    const rows = alerts.map((item) => {
      const isCodeMismatch = item.type === 'code_mismatch';
      return {
        type: isCodeMismatch ? 'Code invalide' : 'Visage non reconnu',
        employee: item.name || '—',
        similarity: item.similarity != null ? `${Math.round(item.similarity * 100)}%` : '—',
        date: item.createdAt?.toDate
          ? item.createdAt.toDate().toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
        photo: !isCodeMismatch ? item.photoBase64 || null : null,
      };
    });
    navigation.navigate('ReportPreview', {
      title: 'Rapport des alertes',
      subtitle: 'Échecs de vérification (code ou visage) les plus récents',
      columns: ALERT_COLUMNS,
      rows,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title="Aucun signalement"
              subtitle="Les échecs de vérification (code ou visage) sur la borne apparaîtront ici."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isCodeMismatch = item.type === 'code_mismatch';
          return (
            <View style={styles.row}>
              {!isCodeMismatch && item.photoBase64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons
                    name={isCodeMismatch ? 'keypad-outline' : 'person-outline'}
                    size={22}
                    color={colors.textMuted}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {isCodeMismatch
                    ? 'Code secret invalide saisi'
                    : `Visage non reconnu${item.name ? ` — ${item.name}` : ''}`}
                </Text>
                <Text style={styles.meta}>
                  {item.type == null
                    ? `${item.attempts} échecs consécutifs`
                    : !isCodeMismatch && item.similarity != null
                    ? `Ressemblance avec le code saisi : ${Math.round(item.similarity * 100)}%`
                    : null}
                </Text>
                <Text style={styles.meta}>
                  {item.createdAt?.toDate
                    ? item.createdAt.toDate().toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {alerts.length > 0 ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleExport}
          accessibilityLabel="Exporter les alertes en PDF"
        >
          <Ionicons name="download-outline" size={26} color={colors.white} />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption },
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
