import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Request location permission with a mandatory Google Play Store rationale.
 * @param rationaleTitle Title of the rationale dialog
 * @param rationaleMessage Detailed explanation of why the app needs location
 */
export const requestLocationPermission = async (
  rationaleTitle = 'Location Access',
  rationaleMessage = 'EkalGo needs your location to find nearby travelers and travel moments. Your location is never shared without your consent.'
) => {
  return new Promise<Location.LocationPermissionResponse>(async (resolve) => {
    // 1. Check existing status
    const { status: existingStatus, canAskAgain } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return resolve({ status: Location.PermissionStatus.GRANTED, granted: true, expires: 'never', canAskAgain: true });
    }

    // 2. Show Rationale (MANDATORY for Play Store)
    Alert.alert(
      rationaleTitle,
      rationaleMessage,
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve({ status: Location.PermissionStatus.DENIED, granted: false, expires: 'never', canAskAgain })
        },
        {
          text: 'Continue',
          onPress: async () => {
             const result = await Location.requestForegroundPermissionsAsync();
             if (result.status === 'denied' && !result.canAskAgain) {
               Alert.alert(
                 'Permission Required',
                 'Location permission is permanently denied. Please enable it in Settings to use this feature.',
                 [
                   { text: 'Cancel', style: 'cancel' },
                   { text: 'Open Settings', onPress: () => Linking.openSettings() }
                 ]
               );
             }
             resolve(result);
          }
        }
      ]
    );
  });
};
