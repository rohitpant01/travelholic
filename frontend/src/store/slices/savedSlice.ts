import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SavedState {
  ids: string[];              // Saved destination IDs for quick lookup
  destinations: any[];        // Full saved destination objects
  loaded: boolean;
}

const initialState: SavedState = {
  ids: [],
  destinations: [],
  loaded: false,
};

const savedSlice = createSlice({
  name: 'saved',
  initialState,
  reducers: {
    setSavedDestinations(state, action: PayloadAction<any[]>) {
      state.destinations = action.payload;
      state.ids = action.payload.map((d: any) => d.title || d.name || d.id);
      state.loaded = true;
    },
    addSaved(state, action: PayloadAction<any>) {
      const item = action.payload;
      const id = item.title || item.name || item.id;
      if (!state.ids.includes(id)) {
        state.ids.push(id);
        state.destinations.unshift(item);
      }
    },
    removeSaved(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.ids = state.ids.filter(i => i !== id);
      state.destinations = state.destinations.filter(
        (d: any) => (d.id || d.title || d.name) !== id
      );
    },
    clearSaved(state) {
      state.ids = [];
      state.destinations = [];
      state.loaded = false;
    },
  },
});

export const { setSavedDestinations, addSaved, removeSaved, clearSaved } = savedSlice.actions;
export default savedSlice.reducer;
