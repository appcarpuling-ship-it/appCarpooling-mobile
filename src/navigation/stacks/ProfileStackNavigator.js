import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';

import ProfileScreen from '../../screens/main/profile/ProfileScreen';
import EditProfileScreen from '../../screens/main/profile/EditProfileScreen';
import TermsScreen from '../../screens/main/profile/TermsScreen';
import HelpScreen from '../../screens/main/profile/HelpScreen';
import NotificationsScreen from '../../screens/main/profile/NotificationsScreen';
import VehiclesScreen from '../../screens/main/profile/VehiclesScreen';
import VehicleFormScreen from '../../screens/main/profile/VehicleFormScreen';
import UserReviewsScreen from '../../screens/main/common/UserReviewsScreen';
import CreateReviewScreen from '../../screens/main/common/CreateReviewScreen';
import ReferralScreen from '../../screens/main/profile/ReferralScreen';

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
        headerTitleAlign: 'center',
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
        name="ReferralScreen"
        component={ReferralScreen}
        options={{ title: 'Código Promocional' }}
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
