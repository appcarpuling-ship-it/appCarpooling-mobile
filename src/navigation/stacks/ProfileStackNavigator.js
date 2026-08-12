import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useHeaderStatusBarHeight } from '../useHeaderStatusBarHeight';

import ProfileScreen from '../../screens/main/profile/ProfileScreen';
import EditProfileScreen from '../../screens/main/profile/EditProfileScreen';
import TermsScreen from '../../screens/main/profile/TermsScreen';
import PrivacyScreen from '../../screens/main/profile/PrivacyScreen';
import CookiesScreen from '../../screens/main/profile/CookiesScreen';
import HelpScreen from '../../screens/main/profile/HelpScreen';
import NotificationsScreen from '../../screens/main/profile/NotificationsScreen';
import VehiclesScreen from '../../screens/main/profile/VehiclesScreen';
import VehicleFormScreen from '../../screens/main/profile/VehicleFormScreen';
import UserReviewsScreen from '../../screens/main/common/UserReviewsScreen';
import CreateReviewScreen from '../../screens/main/common/CreateReviewScreen';
import ReferralScreen from '../../screens/main/profile/ReferralScreen';
import CouponsScreen from '../../screens/main/profile/CouponsScreen';
import BlockedUsersScreen from '../../screens/main/profile/BlockedUsersScreen';

const Stack = createStackNavigator();

const ProfileStackNavigator = () => {
  const { colors } = useColors();
  const headerStatusBarHeight = useHeaderStatusBarHeight();
  
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStatusBarHeight,
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
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity onPress={navigation.goBack} style={{ paddingHorizontal: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null,
      })}
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
        name="Coupons"
        component={CouponsScreen}
        options={{ title: 'Mis Cupones' }}
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
        // La pantalla trae su propio header (cerrar + "Leer todas") y su propio
        // paddingTop de inset: con el header nativo encima quedaban los dos.
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ title: 'Términos y Condiciones' }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: 'Política de Privacidad' }}
      />
      <Stack.Screen
        name="Cookies"
        component={CookiesScreen}
        options={{ title: 'Cookies' }}
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
        // Mismo criterio que CreateReviewFromTrip: una vez que se abre, se sale calificando.
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: 'Usuarios bloqueados' }}
      />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator;
