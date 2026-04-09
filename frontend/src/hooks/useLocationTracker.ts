import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { discoverAPI } from '../api/services';
import { useSocket } from '../context/SocketContext';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { updateUser } from '../store/slices/authSlice';

export const useLocationTracker = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  
  const { socket } = useSocket();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const lastUpdateTime = useRef<number>(0);
  const MIN_UPDATE_INTERVAL = 30000; // 30 seconds debounce for API
  const MIN_DISTANCE_CHANGE = 20; // 20 meters before we update API

  const updateBackendLocation = useCallback(async (coords: { latitude: number; longitude: number }) => {
    try {
      const now = Date.now();
      if (now - lastUpdateTime.current < MIN_UPDATE_INTERVAL) return;
      
      console.log('[LOCATION TRACKER] Updating backend:', coords);
      const res = await discoverAPI.updateLocation(coords.latitude, coords.longitude);
      
      if (res.data.success) {
        dispatch(updateUser(res.data.user));
        lastUpdateTime.current = now;
      }
      
      // Also broadcast via socket for real-time movement to nearby users
      if (socket) {
        socket.emit('update_location', { lat: coords.latitude, lng: coords.longitude });
      }
    } catch (err) {
      console.error('[LOCATION TRACKER] Backend update failed:', err);
    }
  }, [socket, dispatch]);

  useEffect(() => {
    let subscriber: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Initial fix
      const initialLocation = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });
      setLocation(initialLocation);
      updateBackendLocation(initialLocation.coords);

      // Start watching
      subscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: MIN_DISTANCE_CHANGE, // meter threshold
          timeInterval: 10000, // 10s min interval
        },
        (newLocation) => {
          setLocation(newLocation);
          updateBackendLocation(newLocation.coords);
        }
      );
    };

    startTracking();

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, [updateBackendLocation]);

  const refreshLocation = async () => {
    try {
      const currentLoc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High 
      });
      setLocation(currentLoc);
      await updateBackendLocation(currentLoc.coords);
      return currentLoc;
    } catch (err) {
      console.error('[LOCATION TRACKER] Refresh failed:', err);
      return null;
    }
  };

  return {
    location,
    errorMsg,
    permissionStatus,
    refreshLocation
  };
};
