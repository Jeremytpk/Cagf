import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/theme';
import DashboardScreen from '../screens/admin/DashboardScreen';
import EmployeesListScreen from '../screens/admin/EmployeesListScreen';
import AttendanceScreen from '../screens/admin/AttendanceScreen';
import ScanAlertsScreen from '../screens/admin/ScanAlertsScreen';
import VacationsListScreen from '../screens/admin/VacationsListScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Dashboard: 'grid-outline',
  Employees: 'people-outline',
  Attendance: 'time-outline',
  Vacations: 'calendar-outline',
  Alerts: 'alert-circle-outline',
};

const TITLES = {
  Dashboard: 'Tableau de bord',
  Employees: 'Employés',
  Attendance: 'Présences',
  Vacations: 'Congés',
  Alerts: 'Alertes',
};

export default function AdminTabNavigator({ navigation }) {
  const { isAdmin, initializing, logout } = useAuth();

  useEffect(() => {
    if (!initializing && !isAdmin) {
      navigation.replace('AdminLogin');
    }
  }, [initializing, isAdmin]);

  if (initializing || !isAdmin) return null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        title: TITLES[route.name],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size} />,
        headerRight: () => (
          <TouchableOpacity onPress={logout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Employees" component={EmployeesListScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Vacations" component={VacationsListScreen} />
      <Tab.Screen name="Alerts" component={ScanAlertsScreen} />
    </Tab.Navigator>
  );
}
