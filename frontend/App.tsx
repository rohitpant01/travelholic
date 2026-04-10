// Metro Refresh: 2026-04-03T17:53:55Z
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useDispatch, useSelector, Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  View, Text, TouchableOpacity, ActivityIndicator, 
  StyleSheet, Platform, AppState, KeyboardAvoidingView, 
  TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

import store, { RootState, AppDispatch } from './src/store';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { setUser, setToken, setLoading, updateUser } from './src/store/slices/authSlice';
import { upsertMessage, upsertTripMessage, updateMatchOnlineStatus, setUnreadCounts, addMatch, setTotalUnread, setMatches, removeMatch } from './src/store/slices/chatSlice';
import { fetchNotifications, addNotification, setUnreadCount, markAllRead } from './src/store/slices/notificationSlice';
import { userAPI, chatAPI, matchAPI, tripAPI } from './src/api/services';
import { API_BASE_URL } from './src/api/client';
import { useSocket, SocketProvider } from './src/context/SocketContext';
import { COLORS } from './src/utils/theme';
import MessageToast from './src/components/MessageToast';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ToastProvider } from './src/context/ToastContext';
import { ActionToast } from './src/components/ActionToast';

const SOCKET_URL = API_BASE_URL.replace('/api', '');

import SplashScreen from './src/screens/SplashScreen';
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import Step1AccountScreen from './src/screens/register/Step1AccountScreen';
import EmailVerificationScreen from './src/screens/register/EmailVerificationScreen';
import Step2OTPScreen from './src/screens/register/Step2OTPScreen';
import Step3PersonalScreen from './src/screens/register/Step3PersonalScreen';
import Step4LocationScreen from './src/screens/register/Step4LocationScreen';
import Step5PhotosScreen from './src/screens/register/Step5PhotosScreen';
import Step6InterestsScreen from './src/screens/register/Step6InterestsScreen';
import Step7PreferencesScreen from './src/screens/register/Step7PreferencesScreen';
import VerificationScreen from './src/screens/register/VerificationScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import PlaceDiscoveryScreen from './src/screens/PlaceDiscoveryScreen';
import DayPlannerScreen from './src/screens/DayPlannerScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import ChatScreen from './src/screens/ChatScreen';
import GroupDetailsScreen from './src/screens/GroupDetailsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserDetailScreen from './src/screens/UserDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MapScreen from './src/screens/MapScreen';
import WhoLikedMeScreen from './src/screens/WhoLikedMeScreen';
import TripsScreen from './src/screens/TripsScreen';
import CreateTripScreen from './src/screens/CreateTripScreen';
import TripDetailScreen from './src/screens/TripDetailScreen';
import MyMatchesScreen from './src/screens/MyMatchesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import AIItineraryScreen from './src/screens/AIItineraryScreen';
import PlaceDetailsScreen from './src/screens/PlaceDetailsScreen';
import AllDestinationsScreen from './src/screens/AllDestinationsScreen';
import SavedDestinationsScreen from './src/screens/SavedDestinationsScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import CategoryDetailsScreen from './src/screens/CategoryDetailsScreen';
import LocationPickerScreen from './src/screens/LocationPickerScreen';
import LyraItineraryScreen from './src/screens/LyraItineraryScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import PrivacySafetyScreen from './src/screens/PrivacySafetyScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import AboutScreen from './src/screens/AboutScreen';
import ProfileViewsScreen from './src/screens/ProfileViewsScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import ChecklistDetailScreen from './src/screens/ChecklistDetailScreen';

import apiClient from './src/api/client';

import { RootStackParamList } from './src/types/navigation';
export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function RaisedTripButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        top: -22,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View style={{
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: COLORS.teal,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.teal, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
        borderWidth: 4, borderColor: COLORS.white,
      }}>
        <Ionicons name="airplane" size={26} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}


function MainTabs() {
  const totalUnread = useSelector((s: RootState) => s.chat.totalUnread);
  const unreadCount = useSelector((s: RootState) => s.notification.unreadCount);
  const chatsWithUnread = useSelector((s: RootState) => s.chat.chatsWithUnread);
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 62 + insets.bottom : 66;
  const TAB_PADDING_BOTTOM = Platform.OS === 'android' ? insets.bottom + 4 : 8;

  return (
    <Tab.Navigator
      initialRouteName="Travelers"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: TAB_BAR_HEIGHT,
          paddingBottom: TAB_PADDING_BOTTOM,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Explorer') iconName = focused ? 'compass' : 'compass-outline';
          else if (route.name === 'Travelers') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Notifications') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Matches') iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Travelers" component={DiscoverScreen} />
      <Tab.Screen name="Explorer" component={PlaceDiscoveryScreen} />
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <RaisedTripButton onPress={() => props.onPress && props.onPress({} as any)} />
          ),
        }}
      />
      <Tab.Screen 
        name="Matches" 
        component={MatchesScreen} 
        options={{ 
          tabBarBadge: chatsWithUnread > 0 ? chatsWithUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: '#22c55e', color: '#fff', fontSize: 10 }
        }} 
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Register_Step1" component={Step1AccountScreen} />
    </Stack.Navigator>
  );
}

function OnboardingStack({ initialRoute }: { initialRoute: keyof RootStackParamList }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Register_Step3" component={Step3PersonalScreen} />
      <Stack.Screen name="Register_Step4" component={Step4LocationScreen} />
      <Stack.Screen name="Register_Step5" component={Step5PhotosScreen} />
      <Stack.Screen name="Register_Step6" component={Step6InterestsScreen} />
      <Stack.Screen name="Register_Step7" component={Step7PreferencesScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, user, isLoading } = useSelector((state: RootState) => state.auth);
  const { socket } = useSocket();
  const dispatch = useDispatch<AppDispatch>();
  const [activeToast, setActiveToast] = useState<any>(null);
  const activeMatchIdRef = useRef<string | null>(null);

  // Initialize Push Notifications
  usePushNotifications(user);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userData = await AsyncStorage.getItem('user');

        if (token && userData && userData !== 'undefined' && userData !== 'null') {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          dispatch(setToken(token));

          // Show cached user immediately so UI is not blocked
          try {
            const parsedUser = JSON.parse(userData);
            if (parsedUser) {
              dispatch(setUser(parsedUser));
            }
          } catch (e) {
            console.warn('[bootstrapAuth] Failed to parse cached user:', e);
          }

          // ✅ FIX: Extract .data.user from the Axios response
          // Previously: dispatch(updateUser(freshUser))  ← was passing the whole Axios response object
          // Now:        dispatch(updateUser(freshUser.data.user)) ← correctly extracts the user object
          try {
            const response = await userAPI.getProfile();
            const freshUser = response?.data?.user;
            if (freshUser) {
              dispatch(updateUser(freshUser));
              await AsyncStorage.setItem('user', JSON.stringify(freshUser));

              // Fetch matches and unread count globally for instant real-time parity
              // This logic is moved to a reactive useEffect below
            }
          } catch (apiError) {
            console.warn('[bootstrapAuth] Could not refresh user, using cache:', apiError);
          }
        }
      } catch (e) {
        console.error('Auth bootstrap error:', e);
      } finally {
        dispatch(setLoading(false));
      }
    };
    bootstrapAuth();
  }, []);

  // ✅ New reactive sync effect
  useEffect(() => {
    if (isAuthenticated && user?._id) {
        const syncChatData = async () => {
          try {
            const [unreadRes, matchesRes, tripRes] = await Promise.all([
              chatAPI.getUnreadCount(),
              matchAPI.getMatches(),
              tripAPI.getMyTrips(),
              dispatch(fetchNotifications())
            ]);

            const privateMatches = matchesRes.data.matches.map((m: any) => ({ ...m, type: 'private' }));
            const groupTrips = tripRes.data.trips
              .filter((t: any) => t.tripType === 'social')
              .map((t: any) => ({
              matchId: t._id,
              type: 'group',
              user: {
                _id: t._id,
                firstName: t.name || `${t.source?.city} → ${t.destination?.city}`,
                profilePhoto: null,
                isOnline: false,
              },
              lastMessage: t.lastMessage,
              matchedAt: t.createdAt,
              isTrip: true,
              tripData: t,
              unreadCount: t.unreadCount || 0
            }));

            const combined = [...privateMatches, ...groupTrips];

            dispatch(setTotalUnread(unreadRes.data.count));
            dispatch(setMatches(combined));
            
            // ✅ CRITICAL: Populate unreadByMatch so clearing logic works
            dispatch(setUnreadCounts(
              combined.map((m: any) => ({ matchId: m.matchId, count: m.unreadCount || 0 }))
            ));

            console.log('[SYNC] Chat and Trip data synchronized');
          } catch (err) {
            console.warn('[SYNC] Chat startup fetch failed:', err);
          }
        };
       syncChatData();
    }
  }, [isAuthenticated, user?._id]);
  
  // ✅ NEW: Notification Acknowledgement & Startup Sync
  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    // 1. Listen for background/foreground delivery to send ACK
    const sub = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      if (data && (data.id || data.messageId || data._id)) {
        console.log('[PUSH] Received notification. Sending ACK to server...');
        try {
          await apiClient.post('/notifications/ack', {
            notificationId: data.id,
            messageId: data.messageId || data._id || data.chatId
          });
        } catch (e) {
          console.warn('[PUSH ACK ERROR]', e);
        }
      }
    });

    // 2. Perform Startup "Delta Sync" for missed messages/notifications
    const syncMissedData = async () => {
      try {
        const lastSync = await AsyncStorage.getItem('last_sync_time');
        const syncTime = lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        console.log(`[SYNC] Fetching missed data since ${syncTime}`);
        const response = await apiClient.get(`/notifications/sync?lastSyncedAt=${syncTime}`);
        
        if (response.data.messages && response.data.messages.length > 0) {
          console.log(`[SYNC] Recovered ${response.data.messages.length} missed messages`);
          response.data.messages.forEach((msg: any) => {
             // Use unified upsert logic
             const isGroupMessage = !!msg.trip || msg.chatType === 'group' || !!msg.tripId;
             if (isGroupMessage) {
               dispatch(upsertTripMessage({ message: msg, currentUserId: user._id }));
             } else {
               dispatch(upsertMessage({ message: msg, currentUserId: user._id }));
             }
          });
        }

        if (response.data.notifications && response.data.notifications.length > 0) {
          console.log(`[SYNC] Recovered ${response.data.notifications.length} missed notifications`);
          response.data.notifications.forEach((note: any) => {
            dispatch(addNotification(note));
          });
        }

        await AsyncStorage.setItem('last_sync_time', response.data.serverTime || new Date().toISOString());
      } catch (e) {
        console.warn('[SYNC ERROR]', e);
      }
    };

    syncMissedData();
    return () => sub.remove();
  }, [isAuthenticated, user?._id]);
  
  // Handle Foregrounding (App reopen/resume)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isAuthenticated && user?._id) {
        console.log('[APP] Foregrounded. Refreshing data and ensuring socket connectivity...');
        
        // Force socket reconnection if disconnected
        if (socket && !socket.connected) {
          console.log('[SOCKET] Forcing reconnection on foreground transition');
          socket.connect();
        }

        // 🚀 STAGGERED SYNC: Prevents 503 outages by not hitting the server all at once
        const syncSequence = async () => {
           try {
             await dispatch(fetchNotifications());
             // Small gap to let server breathe
             await new Promise(resolve => setTimeout(resolve, 300));
             
             const [matchRes, tripRes] = await Promise.all([
               matchAPI.getMatches(),
               tripAPI.getMyTrips()
             ]);
 
             const privateMatches = matchRes.data.matches.map((m: any) => ({ ...m, type: 'private' }));
             const groupTrips = tripRes.data.trips.map((t: any) => ({
               matchId: t._id,
               type: 'group',
               user: {
                 _id: t._id,
                 firstName: t.groupName || t.name || `${t.source?.city} → ${t.destination?.city}`,
                 profilePhoto: t.groupIcon || null,
                 isOnline: false,
               },
               lastMessage: t.lastMessage,
               matchedAt: t.createdAt,
               isTrip: true,
               tripData: t,
               unreadCount: t.unreadCount || 0
             }));
             dispatch(setMatches([...privateMatches, ...groupTrips]));
           } catch (e) {
             console.warn('[SYNC] Foreground refresh failed slightly:', e);
           }
        };
 
        syncSequence();
      }
    });
    return () => subscription.remove();
  }, [isAuthenticated, user?._id]);

  const activeMatchId = useSelector((s: RootState) => s.chat.activeMatchId);

  useEffect(() => {
    activeMatchIdRef.current = activeMatchId;
  }, [activeMatchId]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id || !socket) return;
    
    // ✅ UNIFIED: backend emits 'receive_message' for BOTH individual AND group messages
    const onReceiveMessage = (data: any) => {
      // Detect message type: group messages have a `trip` field or no `matchId`
      const isGroupMessage = !!data.trip || data.chatType === 'group' || !!data.tripId;
      const matchId = isGroupMessage
        ? String(data.trip || data.chatId || data.tripId)
        : String(data.matchId || data.chatId);

      console.log(`[SOCKET] receive_message (${isGroupMessage ? 'group' : 'individual'}):`, {
        matchId,
        senderId: data.sender?._id || data.sender,
        text: data.text,
        receiver: data.receiver
      });

      // 1. Update Redux list (correct action based on type)
      if (isGroupMessage) {
        dispatch(upsertTripMessage({
          message: { ...data, trip: matchId },
          currentUserId: user._id,
        }));
      } else {
        // Ensure matchId/receiver is present for individual messages so Redux works
        const messageToUpsert = { 
          ...data, 
          matchId: matchId,
          receiver: data.receiver || user._id // fallback to current user if receiver missing (not usual)
        };
        dispatch(upsertMessage({ message: messageToUpsert, currentUserId: user._id }));
      }

      // 2. Derive context
      const senderId = String(data.sender?._id || data.sender);
      const currentUserId = String(user._id);
      const activeMatchIdStr = activeMatchIdRef.current ? String(activeMatchIdRef.current) : null;
      const isFromMe = senderId === currentUserId;
      const isActiveChat = !!activeMatchIdStr && activeMatchIdStr === matchId;

      // 3. Emit delivery receipt (individual only, and only if I'm receiver)
      if (!isFromMe && !isGroupMessage) {
        socket.emit('message_delivered', { messageId: data._id, chatId: matchId, chatType: 'individual' });
      }

      // 4. Show in-app toast if the chat is not currently open
      if (!isFromMe && !isActiveChat) {
        const groupName = data.tripName || data.groupName || '';
        setActiveToast({
          senderName: data.sender?.firstName || data.senderName || (isGroupMessage ? 'Trip Member' : 'Match'),
          senderPhoto: data.sender?.photos?.[0]?.url || data.senderPhoto,
          text: data.text || (data.type === 'voice' ? '🎤 Voice' : data.type === 'image' ? '📷 Photo' : data.type === 'location' ? '📍 Location' : ''),
          matchId,
          userId: senderId,
          isTrip: isGroupMessage,
          groupName: groupName,
          unreadCount: data.unreadCount,
        });
      }
    };

    const onUserOnline = (data: any) => {
      dispatch(updateMatchOnlineStatus({ 
        userId: data.userId, 
        isOnline: data.isOnline,
        activityStatus: data.activityStatus,
        lastSeen: data.lastSeen,
      }));
    };

    const onLikeReceived = (data: any) => {
      setActiveToast({
        senderName: data.fromUserName || 'Someone',
        senderPhoto: data.fromUserPhoto,
        text: `liked your profile! 👍`,
        matchId: '',
        userId: data.fromUserId,
      });
    };

    const onSuperLikeReceived = (data: any) => {
      setActiveToast({
        senderName: data.fromUserName || 'Someone',
        senderPhoto: data.fromUserPhoto,
        text: `SUPER LIKED you! ⭐`,
        matchId: '',
        userId: data.fromUserId,
      });
    };

    const onNewMatch = (data: any) => {
      console.log('[SOCKET] new_match:', data);
      if (data.match) {
        dispatch(addMatch(data.match));
      }
      setActiveToast({
        senderName: data.matchedUser?.firstName || 'Someone',
        senderPhoto: data.matchedUser?.profilePhoto,
        text: `You matched! Start chatting 💬`,
        matchId: data.matchId,
        userId: data.matchedUser?._id,
      });
    };

    const onNewNotification = (data: any) => {
      console.log('[SOCKET] New notification:', data);
      if (typeof data.unreadCount === 'number' && Object.keys(data).length === 1) {
        dispatch(setUnreadCount(data.unreadCount));
      } else {
        dispatch(addNotification(data));
      }
    };

    const onNotificationsReadSync = () => {
      console.log('[SOCKET] Sync notifications_read_sync');
      dispatch(markAllRead());
    };

    const onMatchRemoved = (data: { matchId: string }) => {
      console.log('[SOCKET] Match removed:', data.matchId);
      dispatch(removeMatch(data.matchId));
    };

    const onMessageStatusUpdate = (data: any) => {
      console.log('[SOCKET] message_status_update:', data);
      dispatch(updateMessageStatus({
        chatId: data.chatId,
        messageId: data.messageId,
        status: data.status
      }));
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('user_online', onUserOnline);
    socket.on('like_received', onLikeReceived);
    socket.on('superlike_received', onSuperLikeReceived);
    socket.on('new_match', onNewMatch);
    socket.on('new_notification', onNewNotification);
    socket.on('notifications_read_sync', onNotificationsReadSync);
    socket.on('match_removed', onMatchRemoved);
    socket.on('message_status_update', onMessageStatusUpdate);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('user_online', onUserOnline);
      socket.off('like_received', onLikeReceived);
      socket.off('superlike_received', onSuperLikeReceived);
      socket.off('new_match', onNewMatch);
      socket.off('new_notification', onNewNotification);
      socket.off('notifications_read_sync', onNotificationsReadSync);
      socket.off('match_removed', onMatchRemoved);
      socket.off('message_status_update', onMessageStatusUpdate);
    };
  }, [isAuthenticated, user?._id, socket]);

  useEffect(() => {
    let unmounted = false;
    if (isAuthenticated && user) {
      const updateLocationPassive = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && !unmounted) {
            let loc = await Location.getLastKnownPositionAsync();
            if (!loc) {
              loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }
            const { latitude, longitude } = loc.coords;
            await userAPI.updateLocation({ latitude, longitude });
          }
        } catch (e) {
          console.log('[AUTO-LOCATION] Update failed silently');
        }
      };
      updateLocationPassive();
    }
    return () => { unmounted = true; };
  }, [isAuthenticated, user?._id]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

    const effectiveRegStep = user?.registrationStep ?? 0;
    const isNewUser = effectiveRegStep < 9;
    const isGoogleUser = user?.authProvider === 'google' || !!user?.googleId;
    const needsEmailVerify = !user?.isEmailVerified && !isGoogleUser;

    // 🔍 DEBUG LOGS (Watch terminal for these)
    if (isAuthenticated) {
      console.log(`[NAVIGATOR] Auth state: AUTHENTICATED. User ID: ${user?._id}, Email: ${user?.email}`);
      console.log(`[NAVIGATOR] isNewUser: ${isNewUser}, registrationStep: ${effectiveRegStep}`);
      console.log(`[NAVIGATOR] isEmailVerified: ${user?.isEmailVerified}, isGoogleUser: ${isGoogleUser}`);
      console.log(`[NAVIGATOR] isPhoneVerified: ${user?.isPhoneVerified}, needsEmailVerify: ${needsEmailVerify}`);
    }

    return (
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : (isNewUser && needsEmailVerify) ? (
            <Stack.Screen
              name="Register_EmailVerify"
              component={EmailVerificationScreen}
              initialParams={{ email: user?.email, userId: user?._id }}
            />
          ) : isNewUser ? (
            <Stack.Screen name="Onboarding">
              {() => (
                <OnboardingStack
                  initialRoute={
                    (user?.registrationStep === 3 || user?.registrationStep === 4) ? 'Register_Step3' :
                      user?.registrationStep === 5 ? 'Register_Step4' :
                        user?.registrationStep === 6 ? 'Register_Step5' :
                          user?.registrationStep === 7 ? 'Register_Step6' :
                            user?.registrationStep === 8 ? 'Register_Step7' :
                              'Register_Step3'
                  }
                />
              )}
            </Stack.Screen>
          ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{ 
                animation: 'slide_from_right',
                headerShown: true,
                headerTitle: '', // We set the title dynamically inside ChatScreen
                headerShadowVisible: true,
              }}
            />
            <Stack.Screen 
              name="GroupDetails" 
              component={GroupDetailsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="MyMatches" component={MyMatchesScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="WhoLikedMe" component={WhoLikedMeScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Verification" component={VerificationScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="TripHistory" component={TripHistoryScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="PrivacySafety" component={PrivacySafetyScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ProfileViews" component={ProfileViewsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Checklist" component={ChecklistScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="ChecklistDetail" component={ChecklistDetailScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}

        {/* 🌎 PUBLIC & SHARED SCREENS (Accessible from Universal Links) */}
        <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="AIItinerary" component={AIItineraryScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="LyraItinerary" component={LyraItineraryScreen} options={{ animation: 'slide_from_bottom', headerShown: false }} />
        
        {/* Support Redirects for empty paths */}
        <Stack.Screen name="PostDetailRedirect" component={DiscoverScreen} initialParams={{ initialTab: 'feed' }} options={{ headerShown: false }} />
        <Stack.Screen name="LyraRedirect" component={PlaceDiscoveryScreen} options={{ headerShown: false }} />

        <Stack.Screen name="DayPlanner" component={DayPlannerScreen} options={{ animation: 'slide_from_bottom', headerShown: false }} />
        <Stack.Screen name="CategoryDetails" component={CategoryDetailsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="PlaceDetails" component={PlaceDetailsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="AllDestinations" component={AllDestinationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="SavedDestinations" component={SavedDestinationsScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
        <Stack.Screen name="TermsScreen" component={TermsScreen} options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ animation: 'slide_from_bottom', headerShown: false }} />
      </Stack.Navigator>

      <MessageToast message={activeToast} onDismiss={() => setActiveToast(null)} />
    </View>
  );
}

// ================================================================
// DEEP LINKING CONFIGURATION
// ================================================================
const linking = {
  prefixes: ['ekalgo://', 'https://travelholic-zsqn.onrender.com'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Travelers: 'travelers',
          Explorer: 'explorer',
          Trips: 'trips',
          Matches: 'matches',
          Profile: 'profile',
        },
      },
      Chat: 'chat/:chatId',
      PostDetail: 'post/:postId',
      UserDetail: 'user/:userId',
      AIItinerary: 'itinerary/:id',
      LyraItinerary: 'lyra/:id',
      ProfileViews: 'profile/views',
      Notifications: 'notifications',
      Settings: 'settings',
    },
  },
};

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SocketProvider socketUrl={SOCKET_URL}>
            <ToastProvider>
              <BottomSheetModalProvider>
                <NavigationContainer linking={linking}>
                  <StatusBar style="dark" translucent={false} />
                  <AppNavigator />
                  <ActionToast />
                </NavigationContainer>
              </BottomSheetModalProvider>
            </ToastProvider>
          </SocketProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
});