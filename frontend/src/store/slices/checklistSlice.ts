import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient from '../../api/client';

export interface ChecklistItem {
  _id: string;
  title: string;
  isCompleted: boolean;
  category: string;
}

export interface Checklist {
  _id: string;
  title: string;
  tripType: 'General' | 'Beach' | 'Trek' | 'International' | 'Business' | 'Solo';
  items: ChecklistItem[];
  progress: number;
  trip?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistState {
  checklists: Checklist[];
  currentChecklist: Checklist | null;
  loading: boolean;
  error: string | null;
}

const initialState: ChecklistState = {
  checklists: [],
  currentChecklist: null,
  loading: false,
  error: null,
};

// Async Thunks
export const fetchChecklists = createAsyncThunk(
  'checklist/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/api/checklists');
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch checklists');
    }
  }
);

export const createChecklist = createAsyncThunk(
  'checklist/create',
  async (data: { title: string; tripType: string; autoSuggest: boolean; tripId?: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/api/checklists', data);
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to create checklist');
    }
  }
);

export const toggleChecklistItem = createAsyncThunk(
  'checklist/toggleItem',
  async ({ checklistId, itemId }: { checklistId: string; itemId: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch(`/api/checklists/${checklistId}/toggle-item`, { itemId });
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to toggle item');
    }
  }
);

export const deleteChecklist = createAsyncThunk(
  'checklist/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/api/checklists/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete checklist');
    }
  }
);

export const duplicateChecklist = createAsyncThunk(
  'checklist/duplicate',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/api/checklists/${id}/duplicate`);
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to duplicate checklist');
    }
  }
);

const checklistSlice = createSlice({
  name: 'checklist',
  initialState,
  reducers: {
    setCurrentChecklist: (state, action: PayloadAction<Checklist | null>) => {
      state.currentChecklist = action.payload;
    },
    clearChecklistError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchChecklists.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchChecklists.fulfilled, (state, action) => {
        state.loading = false;
        state.checklists = action.payload;
      })
      .addCase(fetchChecklists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createChecklist.fulfilled, (state, action) => {
        state.checklists.unshift(action.payload);
      })
      // Toggle
      .addCase(toggleChecklistItem.fulfilled, (state, action) => {
        const index = state.checklists.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.checklists[index] = action.payload;
        }
        if (state.currentChecklist?._id === action.payload._id) {
          state.currentChecklist = action.payload;
        }
      })
      // Delete
      .addCase(deleteChecklist.fulfilled, (state, action) => {
        state.checklists = state.checklists.filter(c => c._id !== action.payload);
      })
      // Duplicate
      .addCase(duplicateChecklist.fulfilled, (state, action) => {
        state.checklists.unshift(action.payload);
      });
  },
});

export const { setCurrentChecklist, clearChecklistError } = checklistSlice.actions;
export default checklistSlice.reducer;
