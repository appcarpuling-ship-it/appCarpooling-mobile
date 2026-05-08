import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import CarpoolingsScreen from '../../screens/main/carpool/CarpoolingsScreen';
import TripDetails from '../../screens/main/common/TripDetails';
import EditTripScreen from '../../screens/main/carpool/EditTripScreen';
import MyTripsScreen from '../../screens/main/carpool/MyTripsScreen';
import MyBookingsScreen from '../../screens/main/carpool/MyBookingsScreen';
import MySeatReservationsScreen from '../../screens/main/carpool/MySeatReservationsScreen';
import TripDetailScreen from '../../screens/main/common/TripDetailScreen';
import TripRequestsScreen from '../../screens/main/carpool/TripRequestsScreen';
import CreateReviewScreen from '../../screens/main/common/CreateReviewScreen';
import UserReviewsScreen from '../../screens/main/common/UserReviewsScreen';
import UserProfileScreen from '../../screens/main/common/UserProfileScreen';

const Stack = createStackNavigator();

const CarpoolingsStackNavigator = () => {
  const colors = useColors();
  const { isDarkMode } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
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
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen
        name="Carpoolings"
        component={CarpoolingsScreen}
        options={{ title: 'Mis Viajes' }}
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
        name="MyTrips"
        component={MyTripsScreen}
        options={{ title: 'Viajes Creados' }}
      />
      <Stack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: 'Mis Reservas' }}
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
        options={{ title: 'Crear Reseña' }}
      />
      <Stack.Screen
        name="UserReviewsFromTrip"
        component={UserReviewsScreen}
        options={{ title: 'Reseñas del Usuario' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Stack.Navigator>
  );
};

export default CarpoolingsStackNavigator;