import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';
import HomeScreen from '../../screens/main/home/HomeScreen';
import TripDetailScreen from '../../screens/main/common/TripDetailScreen';
import SearchTripsScreen from '../../screens/main/home/SearchTripsScreen';
import SearchResultsScreen from '../../screens/main/home/SearchResultsScreen';
import BookingScreen from '../../screens/main/home/BookingScreen';
import AllTripsScreen from '../../screens/main/home/AllTripsScreen';
import UserProfileScreen from '../../screens/main/common/UserProfileScreen';
import TripMapScreen from '../../screens/main/trip/TripMapScreen';
import CreateTripGoogleMaps from '../../screens/main/trip/CreateTripGoogleMaps';
import MyTripRequestsScreen from '../../screens/main/home/MyTripRequestsScreen';
import OpenTripRequestsScreen from '../../screens/main/home/OpenTripRequestsScreen';

const Stack = createStackNavigator();

const HomeStackNavigator = () => {
  const colors = useColors();
  const { isDarkMode } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
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
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity onPress={navigation.goBack} style={{ paddingHorizontal: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>
          ) : null,
      })}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SearchTrips"
        component={SearchTripsScreen}
        options={{ title: 'Buscar Viajes' }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripDetail"
        component={TripDetailScreen}
        options={{ title: 'Detalle del Viaje' }}
      />
      <Stack.Screen
        name="TripDetailFromHome"
        component={TripDetailScreen}
        options={{ title: 'Detalle del Viaje' }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Reservar Viaje' }}
      />
      <Stack.Screen
        name="AllTrips"
        component={AllTripsScreen}
        options={{ title: 'Todos los Viajes' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="TripMap"
        component={TripMapScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateTripRequest"
        component={CreateTripGoogleMaps}
        options={{ headerShown: false }}
        initialParams={{ mode: 'request' }}
      />
      <Stack.Screen
        name="MyTripRequests"
        component={MyTripRequestsScreen}
        options={{ title: 'Mis solicitudes' }}
      />
      <Stack.Screen
        name="OpenTripRequests"
        component={OpenTripRequestsScreen}
        options={{ title: 'Solicitudes abiertas' }}
      />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
