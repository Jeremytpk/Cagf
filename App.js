import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme/theme';

import ScanScreen from './src/screens/ScanScreen';
import AdminLoginScreen from './src/screens/admin/AdminLoginScreen';
import AdminSignupScreen from './src/screens/admin/AdminSignupScreen';
import AdminTabNavigator from './src/navigation/AdminTabNavigator';
import RegisterEmployeeScreen from './src/screens/admin/RegisterEmployeeScreen';
import EditEmployeeScreen from './src/screens/admin/EditEmployeeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { fontWeight: '700' },
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AdminSignup" component={AdminSignupScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AdminTabs" component={AdminTabNavigator} options={{ headerShown: false }} />
              <Stack.Screen
                name="RegisterEmployee"
                component={RegisterEmployeeScreen}
                options={{ title: 'Nouvel employé' }}
              />
              <Stack.Screen
                name="EditEmployee"
                component={EditEmployeeScreen}
                options={{ title: "Modifier l'employé" }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
