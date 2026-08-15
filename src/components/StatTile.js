import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { colors, spacing, radius, typography } from '../theme/theme';

export default function StatTile({ icon, label, value, tint = colors.primary, tintBg = colors.primaryLight }) {
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: tintBg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: { ...typography.h1, fontSize: 24, marginBottom: 2 },
  label: { ...typography.caption },
});
