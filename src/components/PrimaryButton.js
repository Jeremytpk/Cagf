import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/theme';

const VARIANTS = {
  primary: { bg: colors.primary, text: colors.white, border: colors.primary },
  accent: { bg: colors.accent, text: colors.white, border: colors.accent },
  danger: { bg: colors.danger, text: colors.white, border: colors.danger },
  outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', text: colors.textSecondary, border: 'transparent' },
};

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={palette.text} style={styles.icon} /> : null}
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: spacing.sm },
  label: { ...typography.h3 },
  disabled: { opacity: 0.5 },
});
