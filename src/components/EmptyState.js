import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/theme';

export default function EmptyState({ icon = 'file-tray-outline', title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  title: { ...typography.h3, marginTop: spacing.md, textAlign: 'center' },
  subtitle: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },
});
