import { Linking } from 'react-native';

/**
 * Maneja el clic en un banner según appGoTo o clickUrl.
 * @param {Object} item - Banner con appGoTo y/o clickUrl
 * @param {Object} navigation - Objeto navigation de React Navigation
 */
export const handleBannerPress = (item, navigation) => {
  if (item.appGoTo && navigation) {
    const nav = navigation;
    switch (item.appGoTo) {
      case 'create_trip':
        nav.navigate('CreateTrip');
        break;
      case 'all_trips':
        nav.navigate('HomeTab', { screen: 'AllTrips', initial: false });
        break;
      case 'search_trips':
        nav.navigate('HomeTab', { screen: 'SearchTrips', initial: false });
        break;
      case 'my_trips':
        nav.navigate('CarpoolingsTab', { screen: 'MyTrips', initial: false });
        break;
      case 'my_bookings':
        nav.navigate('CarpoolingsTab', { screen: 'MyBookings', initial: false });
        break;
      case 'my_seat_reservations':
        nav.navigate('CarpoolingsTab', { screen: 'MySeatReservations', initial: false });
        break;
      case 'profile':
        nav.navigate('ProfileTab', { screen: 'Profile' });
        break;
      case 'home':
        nav.navigate('HomeTab', { screen: 'Home' });
        break;
      default:
        if (item.clickUrl) Linking.openURL(item.clickUrl);
    }
  } else if (item.clickUrl) {
    Linking.openURL(item.clickUrl);
  }
};
