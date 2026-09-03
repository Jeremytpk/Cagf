import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import DateField from '../../components/DateField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { updateVacation, deleteVacation } from '../../services/api';
import { colors, spacing } from '../../theme/theme';

export default function EditVacationScreen({ navigation, route }) {
  const { vacation } = route.params;
  const { getIdToken } = useAuth();
  const [startDate, setStartDate] = useState(vacation.startDate);
  const [endDate, setEndDate] = useState(vacation.endDate);
  const [reason, setReason] = useState(vacation.reason || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (startDate > endDate) {
      Alert.alert('Dates invalides', 'La date de début doit précéder la date de fin.');
      return;
    }
    setSaving(true);
    try {
      const idToken = await getIdToken();
      await updateVacation({
        idToken,
        vacationId: vacation.id,
        startDate,
        endDate,
        reason: reason.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erreur', error.message || 'La mise à jour a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le congé',
      `Voulez-vous vraiment supprimer ce congé de ${vacation.employeeName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const idToken = await getIdToken();
              await deleteVacation({ idToken, vacationId: vacation.id });
              navigation.goBack();
            } catch (error) {
              Alert.alert('Erreur', error.message || 'La suppression a échoué.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <InputField label="Employé" value={`${vacation.employeeName} (${vacation.employeeId})`} editable={false} style={{ opacity: 0.6 }} />
          <DateField label="Début" value={startDate} onChange={setStartDate} />
          <DateField label="Fin" value={endDate} onChange={setEndDate} minimumDate={new Date(`${startDate}T00:00:00`)} />
          <InputField
            label="Motif (optionnel)"
            placeholder="Ex : Congés payés"
            value={reason}
            onChangeText={setReason}
          />
        </Card>

        <PrimaryButton
          label="Enregistrer les modifications"
          icon="checkmark-circle-outline"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={{ marginTop: spacing.lg }}
        />
        <PrimaryButton
          label="Supprimer le congé"
          icon="trash-outline"
          variant="danger"
          onPress={handleDelete}
          loading={deleting}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
