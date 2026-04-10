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
      const response = await apiClient.get('/checklists');
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
      const response = await apiClient.post('/checklists', data);
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
      const response = await apiClient.patch(`/checklists/${checklistId}/toggle-item`, { itemId });
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
      await apiClient.delete(`/checklists/${id}`);
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
      const response = await apiClient.post(`/checklists/${id}/duplicate`);
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to duplicate checklist');
    }
  }
);

export const addItem = createAsyncThunk(
  'checklist/addItem',
  async ({ checklistId, title, category }: { checklistId: string; title: string; category: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/checklists/${checklistId}/items`, { title, category });
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to add item');
    }
  }
);

export const removeItem = createAsyncThunk(
  'checklist/removeItem',
  async ({ checklistId, itemId }: { checklistId: string; itemId: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete(`/checklists/${checklistId}/items/${itemId}`);
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to remove item');
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
      })
      // Add Item (updates the checklist in the list)
      .addCase(addItem.fulfilled, (state, action) => {
        const index = state.checklists.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.checklists[index] = action.payload;
        }
      })
      // Remove Item
      .addCase(removeItem.fulfilled, (state, action) => {
        const index = state.checklists.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.checklists[index] = action.payload;
        }
      });
  },
});

export const { setCurrentChecklist, clearChecklistError } = checklistSlice.actions;
export default checklistSlice.reducer;
