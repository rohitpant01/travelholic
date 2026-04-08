import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { userAPI } from '../api/services';

export interface PushNotificationState {
  expoPushToken?: Notifications.ExpoPushToken;
  notification?: Notifications.Notification;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00B4B4',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
         console.warn('Project ID not found. Ensure app.json has expo.extra.eas.projectId defined for Expo Push Tokens.');
         return undefined;
      }
      token = await Notifications.getExpoPushTokenAsync({
        projectId, 
      });
      console.log('Expo Push Token (FCM mapped):', token.data);
    } catch (e: any) {
      console.warn('Error fetching push token:', e.message);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token?.data;
}

export const usePushNotifications = (user: any) => {
  const navigation = useNavigation<any>();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      // If we have a logged-in user and got a token, send it to the backend immediately
      if (token && user?._id) {
         userAPI.updateProfile({ pushToken: token }).catch(e => console.warn('Failed to sync push token', e));
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data;
        console.log('Notification tapped with data:', data);

        if (!data) return;

        // 🟢 Navigation Logic
        if (data.type === 'like' && data.fromUserId) {
          // Open the profile of the person who liked you
          navigation.navigate('UserDetail', { userId: data.fromUserId });
        } 
        else if (data.type === 'match' && data.matchId) {
          // Open the chat with the new match
          navigation.navigate('Chat', { 
            type: 'individual', 
            chatId: data.matchId,
            userId: data.fromUserId || data.userId, // fallback
            userName: data.fromUserName || 'New Match',
            userPhoto: data.fromUserPhoto
          });
        }
        else if (data.type === 'message' && data.matchId) {
          // Open the specific chat
          navigation.navigate('Chat', { 
            type: 'individual', 
            chatId: data.matchId,
            userName: data.senderName || 'Traveler',
            userPhoto: data.senderPhoto
          });
        }
        else if (data.type === 'comment' && data.postId) {
          navigation.navigate('PostDetail', { postId: data.postId });
        }
      } catch (err) {
        console.error('Notification navigation error:', err);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?._id]);

  return { expoPushToken, notification };
};
