import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';

import ProfileScreen from '../../screens/main/ProfileScreen';
import EditProfileScreen from '../../screens/main/EditProfileScreen';
import TermsScreen from '../../screens/main/TermsScreen';
import HelpScreen from '../../screens/main/HelpScreen';
import NotificationsScreen from '../../screens/main/NotificationsScreen';
import VehiclesScreen from '../../screens/main/VehiclesScreen';
import VehicleFormScreen from '../../screens/main/VehicleFormScreen';
import UserReviewsScreen from '../../screens/main/UserReviewsScreen';
import CreateReviewScreen from '../../screens/main/CreateReviewScreen';

const Stack = createStackNavigator();

const ProfileStackNavigator = () => {
  const { colors } = useColors();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.textPrimary,
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Mi Perfil' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Editar Perfil' }}
      />
      <Stack.Screen
        name="Vehicles"
        component={VehiclesScreen}
        options={{ title: 'Mis Vehículos' }}
      />
      <Stack.Screen
        name="VehicleForm"
        component={VehicleFormScreen}
        options={{ title: 'Vehículo' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notificaciones' }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ title: 'Términos y Condiciones' }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Ayuda' }}
      />
      <Stack.Screen
        name="UserReviews"
        component={UserReviewsScreen}
        options={{ title: 'Reseñas' }}
      />
      <Stack.Screen
        name="CreateReview"
        component={CreateReviewScreen}
        options={{ title: 'Crear Reseña' }}
      />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator;
