import { Linking } from 'react-native';
import { isAppDestinationKey, resolveAppDestination } from './appDestinations';

/**
 * Maneja el clic en un banner según appGoTo o clickUrl.
 * @param {Object} item - Banner con appGoTo y/o clickUrl
 * @param {Object} navigation - Objeto navigation de React Navigation
 */
export const handleBannerPress = (item, navigation) => {
  if (item.appGoTo && navigation && isAppDestinationKey(item.appGoTo)) {
    resolveAppDestination(navigation, item.appGoTo);
  } else if (item.clickUrl) {
    Linking.openURL(item.clickUrl);
  }
};
