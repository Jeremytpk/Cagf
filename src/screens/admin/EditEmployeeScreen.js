import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from '../../components/CameraCapture';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { updateEmployee, deleteEmployee, regenerateEmployeeCode, getEmployeeCode } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme/theme';

export default function EditEmployeeScreen({ navigation, route }) {
  const { employee } = route.params;
  const { getIdToken } = useAuth();
  const [name, setName] = useState(employee.name || '');
  const [department, setDepartment] = useState(employee.department || '');
  const [retaking, setRetaking] = useState(false);
  const [newPhoto, setNewPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [codeValue, setCodeValue] = useState(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  const handleCapture = (base64, error) => {
    if (error || !base64) {
      Alert.alert('Erreur', "La capture de la photo a échoué. Réessayez.");
      return;
    }
    setNewPhoto(base64);
    setRetaking(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const idToken = await getIdToken();
      await updateEmployee({
        idToken,
        employeeId: employee.employeeId,
        name: name.trim(),
        department: department.trim() || null,
        photoBase64: newPhoto || undefined,
      });
      Alert.alert('Modifications enregistrées', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'La mise à jour a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCode = async () => {
    if (codeVisible) {
      setCodeVisible(false);
      return;
    }
    if (codeValue) {
      setCodeVisible(true);
      return;
    }
    setLoadingCode(true);
    try {
      const idToken = await getIdToken();
      const result = await getEmployeeCode({ idToken, employeeId: employee.employeeId });
      setCodeValue(result.code);
      setCodeVisible(true);
    } catch (error) {
      Alert.alert(
        'Code indisponible',
        error.message || "Impossible d'afficher le code. Régénérez-le pour en obtenir un nouveau."
      );
    } finally {
      setLoadingCode(false);
    }
  };

  const handleRegenerateCode = () => {
    Alert.alert(
      'Régénérer le code secret',
      "L'ancien code cessera de fonctionner immédiatement. Continuer ?",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Régénérer',
          onPress: async () => {
            setRegenerating(true);
            try {
              const idToken = await getIdToken();
              const result = await regenerateEmployeeCode({ idToken, employeeId: employee.employeeId });
              setCodeValue(result.code);
              setCodeVisible(true);
              Alert.alert('Nouveau code généré', `Code secret : ${result.code}`);
            } catch (error) {
              Alert.alert('Erreur', error.message || 'La régénération a échoué.');
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer l'employé",
      `Voulez-vous vraiment supprimer ${employee.name} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const idToken = await getIdToken();
              await deleteEmployee({ idToken, employeeId: employee.employeeId });
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
          <InputField label="Identifiant employé" value={employee.employeeId} editable={false} style={{ opacity: 0.6 }} />
          <InputField label="Nom complet" value={name} onChangeText={setName} />
          <InputField label="Service (optionnel)" value={department} onChangeText={setDepartment} />
        </Card>

        <View style={styles.codeRow}>
          <Ionicons name="key-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.codeLabel}>Code secret</Text>
          {loadingCode ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.codeSpinner} />
          ) : (
            <Text style={styles.codeValue}>{codeVisible && codeValue ? codeValue : '••••••'}</Text>
          )}
          <TouchableOpacity
            onPress={handleToggleCode}
            disabled={loadingCode}
            accessibilityLabel={codeVisible ? 'Masquer le code secret' : 'Afficher le code secret'}
            style={styles.codeToggle}
          >
            <Ionicons name={codeVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {employee.createdAt?.toDate ? (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              Compte créé le{' '}
              {employee.createdAt.toDate().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}{' '}
              à{' '}
              {employee.createdAt.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Photo de référence</Text>

        {retaking ? (
          <View style={styles.cameraBox}>
            <CameraCapture onCapture={handleCapture} showFacingToggle />
          </View>
        ) : (
          <View style={styles.previewWrap}>
            {newPhoto ? (
              <Image source={{ uri: `data:image/jpeg;base64,${newPhoto}` }} style={styles.preview} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.placeholderText}>Photo actuelle enregistrée</Text>
              </View>
            )}
            <PrimaryButton
              label="Reprendre la photo"
              icon="camera-reverse-outline"
              variant="outline"
              onPress={() => setRetaking(true)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}

        <PrimaryButton
          label="Enregistrer les modifications"
          icon="checkmark-circle-outline"
          onPress={handleSave}
          loading={saving}
          disabled={!name.trim() || saving}
          style={{ marginTop: spacing.lg }}
        />
        <PrimaryButton
          label="Régénérer le code secret"
          icon="key-outline"
          variant="outline"
          onPress={handleRegenerateCode}
          loading={regenerating}
          style={{ marginTop: spacing.md }}
        />
        <PrimaryButton
          label="Supprimer l'employé"
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
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  metaText: { ...typography.caption, marginLeft: spacing.xs },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  codeLabel: { ...typography.caption, marginLeft: spacing.xs, marginRight: spacing.sm },
  codeValue: { ...typography.h3, letterSpacing: 2, flex: 1 },
  codeSpinner: { flex: 1, alignItems: 'flex-start' },
  codeToggle: { padding: spacing.xs },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
  cameraBox: { height: 400, borderRadius: radius.lg, overflow: 'hidden' },
  previewWrap: { alignItems: 'center' },
  preview: { width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: colors.accent },
  previewPlaceholder: {
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  placeholderText: { ...typography.caption },
});
