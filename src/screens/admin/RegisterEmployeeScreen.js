import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from '../../components/CameraCapture';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { registerEmployee } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme/theme';

export default function RegisterEmployeeScreen({ navigation }) {
  const { getIdToken } = useAuth();
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCapture = (base64, error) => {
    if (error || !base64) {
      Alert.alert('Erreur', "La capture de la photo a échoué. Réessayez.");
      return;
    }
    setPhoto(base64);
  };

  const canSubmit = name.trim() && photo && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const idToken = await getIdToken();
      const result = await registerEmployee({
        idToken,
        name: name.trim(),
        department: department.trim() || null,
        photoBase64: photo,
      });
      Alert.alert(
        'Employé enregistré',
        `${result.name} a été ajouté avec succès.\nIdentifiant : ${result.employeeId}\n\nCode secret : ${result.code}\n\nTransmettez-le à l'employé. Vous pourrez le reconsulter à tout moment depuis sa fiche.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Erreur', error.message || "L'enregistrement a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <InputField label="Nom complet" placeholder="Ex : Amina Diallo" value={name} onChangeText={setName} />
          <InputField
            label="Service (optionnel)"
            placeholder="Ex : Comptabilité"
            value={department}
            onChangeText={setDepartment}
          />
        </Card>

        <Text style={styles.sectionTitle}>Photo de référence</Text>
        <Text style={styles.sectionHint}>
          Cadrez le visage dans le carré, de face, avec un bon éclairage. Cette photo servira de référence
          faciale pour tous les futurs pointages.
        </Text>

        {photo ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.preview} />
            <PrimaryButton
              label="Reprendre la photo"
              icon="camera-reverse-outline"
              variant="outline"
              onPress={() => setPhoto(null)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.cameraBox}>
            <CameraCapture onCapture={handleCapture} showFacingToggle />
          </View>
        )}

        <PrimaryButton
          label="Enregistrer l'employé"
          icon="checkmark-circle-outline"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.h3, marginTop: spacing.lg, marginBottom: spacing.xs },
  sectionHint: { ...typography.caption, marginBottom: spacing.md },
  cameraBox: { height: 400, borderRadius: radius.lg, overflow: 'hidden' },
  previewWrap: { alignItems: 'center' },
  preview: { width: 220, height: 220, borderRadius: 110, borderWidth: 3, borderColor: colors.accent },
});
