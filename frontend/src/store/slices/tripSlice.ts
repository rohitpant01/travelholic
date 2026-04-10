import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TripState {
  trips: any[];
  myTrips: any[];
  currentTrip: any | null;
  currentTripMembers: any[];
  tripMessages: Record<string, any[]>;
  filters: {
    budget: string | null;
    travelType: string | null;
    tags: string[];
    mode: string | null;
  };
  loading: boolean;
  activeTab: 'explore' | 'myTrips' | 'aiPlanner';
}

const initialState: TripState = {
  trips: [],
  myTrips: [],
  currentTrip: null,
  currentTripMembers: [],
  tripMessages: {},
  filters: { budget: null, travelType: null, tags: [], mode: null },
  loading: false,
  activeTab: 'aiPlanner',
};

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    setTrips: (state, action: PayloadAction<any[]>) => {
      state.trips = action.payload;
    },
    appendTrips: (state, action: PayloadAction<any[]>) => {
      const existing = new Set(state.trips.map((t: any) => t._id));
      const newTrips = action.payload.filter((t: any) => !existing.has(t._id));
      state.trips = [...state.trips, ...newTrips];
    },
    setMyTrips: (state, action: PayloadAction<any[]>) => {
      state.myTrips = action.payload;
    },
    setCurrentTrip: (state, action: PayloadAction<any>) => {
      state.currentTrip = action.payload;
    },
    setCurrentTripMembers: (state, action: PayloadAction<any[]>) => {
      state.currentTripMembers = action.payload;
    },
    addTripMessage: (state, action: PayloadAction<{ tripId: string; message: any }>) => {
      const { tripId, message } = action.payload;
      if (!state.tripMessages[tripId]) state.tripMessages[tripId] = [];
      // Avoid duplicate
      const exists = state.tripMessages[tripId].find((m: any) => m._id === message._id);
      if (!exists) state.tripMessages[tripId].push(message);
    },
    setTripMessages: (state, action: PayloadAction<{ tripId: string; messages: any[] }>) => {
      state.tripMessages[action.payload.tripId] = action.payload.messages;
    },
    setFilters: (state, action: PayloadAction<Partial<TripState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { budget: null, travelType: null, tags: [], mode: null };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setActiveTab: (state, action: PayloadAction<'explore' | 'myTrips' | 'aiPlanner'>) => {
      state.activeTab = action.payload;
    },
    removeTripFromList: (state, action: PayloadAction<string>) => {
      state.trips = state.trips.filter((t: any) => t._id !== action.payload);
      state.myTrips = state.myTrips.filter((t: any) => t._id !== action.payload);
    },
  },
});

export const {
  setTrips, appendTrips, setMyTrips,
  setCurrentTrip, setCurrentTripMembers,
  addTripMessage, setTripMessages,
  setFilters, clearFilters, setLoading,
  setActiveTab, removeTripFromList,
} = tripSlice.actions;

export default tripSlice.reducer;
