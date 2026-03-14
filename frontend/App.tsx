import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';

import store, { RootState } from './src/store';
import * as Location from 'expo-location';
import { setUser, setToken, setLoading, updateUser } from './src/store/slices/authSlice';
import { incrementUnread, setUnreadCounts } from './src/store/slices/chatSlice';
import { userAPI } from './src/api/services';
import { COLORS } from './src/utils/theme';
import { API_BASE_URL } from './src/api/client';
import MessageToast from './src/components/MessageToast';

const SOCKET_URL = API_BASE_URL.replace('/api', '');

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

// Registration flow
import Step1AccountScreen from './src/screens/register/Step1AccountScreen';
import Step2OTPScreen from './src/screens/register/Step2OTPScreen';
import Step3PersonalScreen from './src/screens/register/Step3PersonalScreen';
import Step4LocationScreen from './src/screens/register/Step4LocationScreen';
import Step5PhotosScreen from './src/screens/register/Step5PhotosScreen';
import Step6InterestsScreen from './src/screens/register/Step6InterestsScreen';
import Step7PreferencesScreen from './src/screens/register/Step7PreferencesScreen';
import VerificationScreen from './src/screens/register/VerificationScreen';

// Main app screens
import DiscoverScreen from './src/screens/DiscoverScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserDetailScreen from './src/screens/UserDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MapScreen from './src/screens/MapScreen';

import apiClient from './src/api/client';

export type RootStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  Register_Step1: undefined;
  Register_Step2: { phone: string; userId: string };
  Register_Step3: undefined;
  Register_Step4: undefined;
  Register_Step5: undefined;
  Register_Step6: undefined;
  Register_Step7: undefined;
  Verification: undefined;
  MainTabs: undefined;
  Chat: { matchId: string; userName: string; userPhoto?: string; userId: string };
  UserDetail: { userId: string };
  EditProfile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const totalUnread = useSelector((s: RootState) => s.chat.totalUnread);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Discover') iconName = focused ? 'compass' : 'compass-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Matches') iconName = focused ? 'heart' : 'heart-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          if (route.name === 'Matches' && totalUnread > 0) {
            return (
              <View style={{ position: 'relative' }}>
                <Ionicons name={iconName} size={size} color={color} />
                <View style={{
                  position: 'absolute', top: -4, right: -6,
                  backgroundColor: '#22c55e',
                  borderRadius: 9, minWidth: 16, height: 16,
                  alignItems: 'center', justifyContent: 'center',
                  paddingHorizontal: 3,
                  borderWidth: 1.5, borderColor: COLORS.white,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </View>
              </View>
            );
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Separate stack for Auth steps 1-2
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

// Separate stack for Onboarding steps 3-7
function OnboardingStack({ initialRoute }: { initialRoute: keyof RootStackParamList }) {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Register_Step3" component={Step3PersonalScreen} />
      <Stack.Screen name="Register_Step4" component={Step4LocationScreen} />
      <Stack.Screen name="Register_Step5" component={Step5PhotosScreen} />
      <Stack.Screen name="Register_Step6" component={Step6InterestsScreen} />
      <Stack.Screen name="Register_Step7" component={Step7PreferencesScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, user, isLoading } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [activeToast, setActiveToast] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeMatchIdRef = useRef<string | null>(null); // track open chat

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userData = await AsyncStorage.getItem('user');
        if (token && userData) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          dispatch(setToken(token));
          dispatch(setUser(JSON.parse(userData)));
        }
      } catch (e) {
        console.error('Auth bootstrap error:', e);
      } finally {
        dispatch(setLoading(false));
      }
    };
    bootstrapAuth();
  }, []);

  // GLOBAL SOCKET: listen for new messages for toast notifications
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const connectSocket = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('new_message', (data: any) => {
        // Increment unread count in Redux (updates tab badge)
        dispatch(incrementUnread({ matchId: data.matchId }));

        // Don't show toast if user is already viewing that chat
        if (activeMatchIdRef.current === data.matchId) return;
        setActiveToast({
          senderName: data.senderName || 'Match',
          senderPhoto: data.senderPhoto,
          text: data.text || '📷 Photo',
          matchId: data.matchId,
          userId: data.senderId,
          unreadCount: data.unreadCount,
        });
      });

      // Show toast when someone likes your profile
      socket.on('like_received', (data: any) => {
        setActiveToast({
          senderName: data.fromUserName || 'Someone',
          senderPhoto: data.fromUserPhoto,
          text: `liked your profile! 👍`,
          matchId: '',           // no chat yet, so no navigation
          userId: data.fromUserId,
          unreadCount: undefined,
        });
      });

      // Show toast when a mutual match is made
      socket.on('new_match', (data: any) => {
        setActiveToast({
          senderName: data.matchedUser?.firstName || 'Someone',
          senderPhoto: data.matchedUser?.profilePhoto,
          text: `You matched! Start chatting 💬`,
          matchId: data.matchId,
          userId: data.matchedUser?._id,
          unreadCount: undefined,
        });
      });

      socketRef.current = socket;
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [isAuthenticated, user?._id]);

  // AUTO-LOCATION UPDATE EFFECT
  useEffect(() => {
    let unmounted = false;
    if (isAuthenticated && user) {
      const updateLocationPassive = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && !unmounted) {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = loc.coords;

            // Route exactly to the new POST endpoint provided 
            await userAPI.updateLocation({ latitude, longitude });
            console.log('[AUTO-LOCATION] coordinates securely updated via new API:', latitude, longitude);
          }
        } catch (e) {
          console.log('[AUTO-LOCATION] Update failed silently');
        }
      };
      
      // Update once on mount when auth is ready
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

    return (
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : !user?.isPhoneVerified ? (
            <Stack.Screen 
              name="Register_Step2" 
              component={Step2OTPScreen} 
              initialParams={{ phone: user?.phone, userId: user?._id }} 
            />
          ) : user?.registrationStep < 8 ? (
            <Stack.Screen name="Onboarding">
              {() => (
                <OnboardingStack 
                  initialRoute={
                    user?.registrationStep === 4 ? 'Register_Step4' :
                    user?.registrationStep === 5 ? 'Register_Step5' :
                    user?.registrationStep === 6 ? 'Register_Step6' :
                    user?.registrationStep === 7 ? 'Register_Step7' :
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
                options={{ animation: 'slide_from_right' }}
                listeners={{
                  focus: (e: any) => { activeMatchIdRef.current = e?.target?.split('-')[0] ?? null; },
                  blur: () => { activeMatchIdRef.current = null; },
                }}
              />
              <Stack.Screen
                name="UserDetail"
                component={UserDetailScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>

        {/* Global new-message toast */}
        <MessageToast
          message={activeToast}
          onDismiss={() => setActiveToast(null)}
        />
      </View>
    );
}

export default function App() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
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
