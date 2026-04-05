import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setSavedDestinations } from '../store/slices/savedSlice';

/**
 * Custom hook to synchronize the global 'saved' state with the user's profile.
 * This ensures that hearts are updated instantly across all screens.
 */
export const useSavedSync = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { loaded } = useSelector((state: RootState) => state.saved);
  const lastSyncRef = useRef<string>('');

  useEffect(() => {
    if (isAuthenticated && user?.savedDestinations) {
      // Create a simple hash/string to check for changes
      const currentSyncKey = JSON.stringify(user.savedDestinations.map(d => d._id || d.id || d.title));
      
      if (currentSyncKey !== lastSyncRef.current) {
        lastSyncRef.current = currentSyncKey;
        dispatch(setSavedDestinations(user.savedDestinations));
      }
    } else if (!isAuthenticated && loaded) {
      // Clear on logout
      lastSyncRef.current = '';
      dispatch(setSavedDestinations([]));
    }
  }, [user?.savedDestinations, isAuthenticated]);
};
