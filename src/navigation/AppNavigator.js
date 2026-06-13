import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../hooks/useColors';
import { useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View } from 'react-native';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerificationScreen from '../screens/auth/VerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen';

// Main navigation
import MainTabNavigator from './MainTabNavigator';
import CreateTripGoogleMaps from '../screens/main/trip/CreateTripGoogleMaps';
import TripDetails from '../screens/main/common/TripDetails';
import TripRequestDetailScreen from '../screens/main/home/TripRequestDetailScreen';
import TripRequestDetailsScreen from '../screens/main/home/TripRequestDetailsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const colors = useColors();
  const { isDarkMode } = useTheme();

  console.log('AppNavigator - isAuthenticated:', isAuthenticated, 'loading:', loading);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // console.log('AppNavigator - Renderizando con isAuthenticated:', isAuthenticated);

  return (
    <Stack.Navigator
      id="AppStack"
      key={isAuthenticated ? 'authenticated' : 'unauthenticated'}
      screenOptions={{ headerShown: false }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : !user?.phone ? (
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen
            name="CreateTrip"
            component={CreateTripGoogleMaps}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TripRequestDetails"
            component={TripRequestDetailsScreen}
            options={{
              headerShown: true,
              title: 'Detalles de la solicitud',
              headerStyle: {
                backgroundColor: isDarkMode ? '#161616' : '#FFFFFF',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB',
              },
              headerTintColor: isDarkMode ? '#FFFFFF' : '#1F2937',
              headerTitleStyle: { fontWeight: '600', fontSize: 18 },
              headerBackTitleVisible: false,
            }}
          />
          <Stack.Screen
            name="TripRequestDetail"
            component={TripRequestDetailScreen}
            options={{
              headerShown: true,
              title: 'Solicitud de viaje',
              headerStyle: {
                backgroundColor: isDarkMode ? '#161616' : '#FFFFFF',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB',
              },
              headerTintColor: isDarkMode ? '#FFFFFF' : '#1F2937',
              headerTitleStyle: { fontWeight: '600', fontSize: 18 },
              headerBackTitleVisible: false,
            }}
          />
          <Stack.Screen
            name="TripDetails"
            component={TripDetails}
            options={{
              headerShown: true,
              title: 'Detalles del Viaje',
              headerStyle: {
                backgroundColor: isDarkMode ? '#161616' : '#FFFFFF',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB',
              },
              headerTintColor: isDarkMode ? '#FFFFFF' : '#1F2937',
              headerTitleStyle: {
                fontWeight: '600',
                fontSize: 18,
                color: isDarkMode ? '#FFFFFF' : '#1F2937',
              },
              headerBackTitleVisible: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
