import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '../theme/theme';

function toDate(isoDate) {
  return isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplay(isoDate) {
  if (!isoDate) return 'Sélectionner une date';
  return toDate(isoDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Sélecteur de date unique, réutilisé pour les bornes de début/fin d'un
// congé. Sur iOS le picker natif "compact" s'affiche en place ; sur Android
// il faut ouvrir/fermer le dialogue natif manuellement.
export default function DateField({ label, value, onChange, minimumDate }) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    onChange(toIsoDate(selectedDate));
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {Platform.OS === 'ios' ? (
        <View style={styles.iosRow}>
          <Text style={styles.value}>{formatDisplay(value)}</Text>
          <DateTimePicker
            value={toDate(value)}
            mode="date"
            display="compact"
            onChange={handleChange}
            minimumDate={minimumDate}
          />
        </View>
      ) : (
        <TouchableOpacity style={styles.input} onPress={() => setShowAndroidPicker(true)} activeOpacity={0.7}>
          <Text style={styles.value}>{formatDisplay(value)}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {Platform.OS === 'android' && showAndroidPicker ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.textSecondary },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body },
});
