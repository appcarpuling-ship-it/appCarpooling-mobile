import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useHeaderStatusBarHeight } from '../useHeaderStatusBarHeight';
import { useTheme } from '../../context/ThemeContext';
import HistoryScreen from '../../screens/main/history/HistoryScreen';
import TripDetails from '../../screens/main/common/TripDetails';
import EditTripScreen from '../../screens/main/carpool/EditTripScreen';
import MySeatReservationsScreen from '../../screens/main/carpool/MySeatReservationsScreen';
import TripDetailScreen from '../../screens/main/common/TripDetailScreen';
import TripRequestsScreen from '../../screens/main/carpool/TripRequestsScreen';
import CreateReviewScreen from '../../screens/main/common/CreateReviewScreen';
import UserReviewsScreen from '../../screens/main/common/UserReviewsScreen';
import UserProfileScreen from '../../screens/main/common/UserProfileScreen';
import ChatDetailScreen from '../../screens/main/chat/ChatDetailScreen';
import TripMapScreen from '../../screens/main/trip/TripMapScreen';

const Stack = createStackNavigator();

// Mismas pantallas destino que CarpoolingsStackNavigator (registradas ahí también):
// MyTripsScreen y MyBookingsScreen, que viven embebidas dentro de HistoryScreen y no
// como rutas propias acá, navegan a estos mismos nombres y ya funcionan probados en
// ese stack. Se duplica el set completo en vez de armar uno a medida para no arriesgar
// una navegación rota — mismo criterio que ChatDetail, que ya vive en tres stacks.
const HistoryStackNavigator = () => {
  const colors = useColors();
  const headerStatusBarHeight = useHeaderStatusBarHeight();
  const { isDarkMode } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStatusBarHeight,
        headerStyle: {
          backgroundColor: isDarkMode ? '#0A0A0A' : '#FFFFFF',
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
        headerTitleAlign: 'center',
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity onPress={navigation.goBack} style={{ paddingHorizontal: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>
          ) : null,
      })}
    >
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripDetails"
        component={TripDetails}
        options={{ title: 'Detalles del Viaje' }}
      />
      <Stack.Screen
        name="EditTrip"
        component={EditTripScreen}
        options={{ title: 'Editar Viaje' }}
      />
      <Stack.Screen
        name="MySeatReservations"
        component={MySeatReservationsScreen}
        options={{ title: 'Mis Reservas de Asiento' }}
      />
      <Stack.Screen
        name="TripDetailFromCarpoolings"
        component={TripDetailScreen}
        options={{ title: 'Detalle del Viaje' }}
      />
      <Stack.Screen
        name="TripRequests"
        component={TripRequestsScreen}
        options={{ title: 'Solicitudes de Reserva' }}
      />
      <Stack.Screen
        name="CreateReviewFromTrip"
        component={CreateReviewScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="UserReviews"
        component={UserReviewsScreen}
        options={{ title: 'Reseñas' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="ChatDetail"
        component={ChatDetailScreen}
        options={{ headerBackTitleVisible: false }}
      />
      <Stack.Screen
        name="TripMap"
        component={TripMapScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default HistoryStackNavigator;
