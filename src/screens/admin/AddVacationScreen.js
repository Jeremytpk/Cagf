import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import Card from '../../components/Card';
import InputField from '../../components/InputField';
import DateField from '../../components/DateField';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { addVacation } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme/theme';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function AddVacationScreen({ navigation }) {
  const { getIdToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (e) => e.name?.toLowerCase().includes(term) || e.employeeId?.toLowerCase().includes(term)
    );
  }, [employees, search]);

  const canSubmit = selectedEmployee && startDate && endDate && startDate <= endDate && !submitting;

  const handleSubmit = async () => {
    if (startDate > endDate) {
      Alert.alert('Dates invalides', 'La date de début doit précéder la date de fin.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await getIdToken();
      await addVacation({
        idToken,
        employeeId: selectedEmployee.employeeId,
        startDate,
        endDate,
        reason: reason.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erreur', error.message || "L'enregistrement a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Employé</Text>

        {selectedEmployee ? (
          <Card style={styles.selectedCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{selectedEmployee.employeeId?.slice(-2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{selectedEmployee.name}</Text>
              <Text style={styles.meta}>
                {selectedEmployee.employeeId}
                {selectedEmployee.department ? ` · ${selectedEmployee.department}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedEmployee(null)}>
              <Text style={styles.changeLink}>Changer</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <View style={{ marginBottom: spacing.lg }}>
            <InputField
              placeholder="Rechercher un employé…"
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filteredEmployees}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => setSelectedEmployee(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.employeeId}
                      {item.department ? ` · ${item.department}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Dates du congé</Text>
        <Card>
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
          label="Enregistrer le congé"
          icon="checkmark-circle-outline"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  selectedCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primary, fontWeight: '700' },
  name: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption },
  changeLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
