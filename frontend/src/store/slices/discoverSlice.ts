import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { discoverAPI } from '../../api/services';

interface DiscoverState {
  profiles: any[];
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
}

export const fetchDiscoveryProfiles = createAsyncThunk(
  'discover/fetchProfiles',
  async ({ page, location, maxDistance, searchCity }: { 
    page: number; 
    location?: { lat: number; lng: number }; 
    maxDistance?: number;
    searchCity?: string;
  }, { rejectWithValue }) => {
    try {
      const res = await discoverAPI.getProfiles({ 
        page, 
        lat: location?.lat, 
        lng: location?.lng,
        maxDistance,
        searchCity
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch travelers');
    }
  }
);

const discoverSlice = createSlice({
  name: 'discover',
  initialState: {
    profiles: [],
    loading: false,
    error: null,
    page: 1,
    hasMore: true,
  } as DiscoverState,
  reducers: {
    setProfiles: (state, action: PayloadAction<any[]>) => {
      state.profiles = action.payload;
    },
    removeProfile: (state, action: PayloadAction<string>) => {
      state.profiles = state.profiles.filter(p => p._id !== action.payload);
    },
    clearDiscovery: (state) => {
      state.profiles = [];
      state.page = 1;
      state.hasMore = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscoveryProfiles.pending, (state, action) => {
        if (action.meta.arg.page === 1 && state.profiles.length === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchDiscoveryProfiles.fulfilled, (state, action) => {
        state.loading = false;
        const newProfiles = action.payload?.profiles || [];
        
        if (action.meta.arg.page === 1) {
          state.profiles = newProfiles;
        } else {
          const existingIds = state.profiles.map(p => p._id);
          const uniqueNew = newProfiles.filter((p: any) => !existingIds.includes(p._id));
          state.profiles = [...state.profiles, ...uniqueNew];
        }
        
        state.page = action.payload?.page || state.page;
        state.hasMore = newProfiles.length > 0;
      })
      .addCase(fetchDiscoveryProfiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setProfiles, removeProfile, clearDiscovery } = discoverSlice.actions;
export default discoverSlice.reducer;
