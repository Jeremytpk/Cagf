import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
];

// Pavé numérique dédié à la saisie du code secret sur la borne. Un vrai
// pavé plutôt qu'un TextInput : la borne ne doit pas dépendre du clavier
// natif de l'appareil qui l'héberge.
export default function CodeKeypad({ length = 6, value, onChange, disabled = false }) {
  const handleKeyPress = (key) => {
    if (disabled) return;
    if (key === 'back') {
      onChange(value.slice(0, -1));
    } else if (key && value.length < length) {
      onChange(value + key);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key, colIndex) => {
              if (key === '') return <View key={colIndex} style={styles.key} />;
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[styles.key, styles.keyButton]}
                  onPress={() => handleKeyPress(key)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  {key === 'back' ? (
                    <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: spacing.lg },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.surface,
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  grid: { width: '100%', maxWidth: 320 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  key: { width: 76, height: 60, alignItems: 'center', justifyContent: 'center' },
  keyButton: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  keyText: { ...typography.h2 },
});
