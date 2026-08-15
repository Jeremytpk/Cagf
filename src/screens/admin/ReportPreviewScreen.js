import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import PrimaryButton from '../../components/PrimaryButton';
import { buildReportHtml, sharePdf } from '../../utils/pdfReport';
import { colors, radius, spacing, typography } from '../../theme/theme';

// Aperçu natif (composants RN, pas le PDF lui-même) du rapport avant
// génération — mêmes données `{ title, subtitle, columns, rows }` que celles
// envoyées à buildReportHtml, pour garantir que l'aperçu et le PDF final
// affichent exactement la même chose.
export default function ReportPreviewScreen({ route }) {
  const { title, subtitle, columns, rows } = route.params;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html = buildReportHtml({ title, subtitle, columns, rows });
      await sharePdf({ html, dialogTitle: title });
    } catch (error) {
      Alert.alert('Erreur', error.message || "La génération du PDF a échoué.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.count}>
          {rows.length} ligne{rows.length > 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="Rien à exporter"
            subtitle="Il n'y a aucune donnée pour ce rapport."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            {item.photo ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.photo}` }} style={styles.thumb} />
            ) : null}
            <View style={{ flex: 1 }}>
              {columns.map((col) => (
                <View key={col.key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{col.label}</Text>
                  <Text style={styles.fieldValue}>{item[col.key] ?? '—'}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      />

      {rows.length > 0 ? (
        <View style={styles.footer}>
          <PrimaryButton
            label="Télécharger le PDF"
            icon="download-outline"
            onPress={handleDownload}
            loading={downloading}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  count: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, marginRight: spacing.md },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  fieldLabel: { ...typography.caption },
  fieldValue: { ...typography.body, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
