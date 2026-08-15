import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import EmptyState from '../../components/EmptyState';
import { colors, radius, spacing, typography } from '../../theme/theme';

export default function ScanAlertsScreen() {
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
              subtitle="Les échecs de reconnaissance répétés sur la borne apparaîtront ici."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.photoBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="person-outline" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.attempts} échecs consécutifs</Text>
              <Text style={styles.meta}>
                {item.similarity != null
                  ? `Meilleure ressemblance : ${Math.round(item.similarity * 100)}%`
                  : 'Aucun visage proche identifié'}
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
        )}
      />
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
});
