import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  age?: number;
  gender?: string;
  bio?: string;
  city?: string;
  country?: string;
  hometown?: string;
  lastVisitedPlace?: string;
  dreamDestination?: string;
  countriesVisited?: string[];
  photos?: any[];
  interests?: string[];
  languages?: string[];
  lookingFor?: string[];
  location?: any;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isPhotoVerified: boolean;
  profileComplete: boolean;
  registrationStep: number;
  likesReceived?: number;
  matchesCount?: number;
  tripsCompleted?: number;
  completedTrips?: any[];
  maxDiscoveryDistance?: number;
  authProvider?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setUser, setToken, setLoading, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
