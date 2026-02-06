import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import CarpoolingsScreen from '../../screens/main/CarpoolingsScreen';
// import CreateTripScreen from '../../screens/main/CreateTripScreen';
import CreateTripGoogleMaps from '../../screens/main/CreateTripGoogleMaps';
import TripDetails from '../../screens/main/TripDetails';
import EditTripScreen from '../../screens/main/EditTripScreen';
import MyTripsScreen from '../../screens/main/MyTripsScreen';
import MyBookingsScreen from '../../screens/main/MyBookingsScreen';
import MySeatReservationsScreen from '../../screens/main/MySeatReservationsScreen';
import TripDetailScreen from '../../screens/main/TripDetailScreen';
import TripRequestsScreen from '../../screens/main/TripRequestsScreen';
import CreateReviewScreen from '../../screens/main/CreateReviewScreen';
import UserReviewsScreen from '../../screens/main/UserReviewsScreen';

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
      }}
    >
      <Stack.Screen
        name="Carpoolings"
        component={CarpoolingsScreen}
        options={{ title: 'Mis Viajes' }}
      />
      <Stack.Screen
        name="CreateTrip"
        component={CreateTripGoogleMaps}
        // component={CreateTripScreen}
        options={{ title: 'Crear Viaje' }}
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
    </Stack.Navigator>
  );
};

export default CarpoolingsStackNavigator;