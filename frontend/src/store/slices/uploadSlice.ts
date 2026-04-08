import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UploadTask {
  id: string; // usually maps to the temp post ID
  progress: number; // 0 to 100
  status: 'uploading' | 'failed' | 'done';
  type: 'post' | 'story';
}

interface UploadState {
  tasks: Record<string, UploadTask>;
}

const initialState: UploadState = {
  tasks: {},
};

const uploadSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    startUpload: (state, action: PayloadAction<{ id: string; type: 'post' | 'story' }>) => {
      state.tasks[action.payload.id] = {
        id: action.payload.id,
        progress: 0,
        status: 'uploading',
        type: action.payload.type,
      };
    },
    updateProgress: (state, action: PayloadAction<{ id: string; progress: number }>) => {
      const task = state.tasks[action.payload.id];
      if (task) {
        task.progress = action.payload.progress;
      }
    },
    completeUpload: (state, action: PayloadAction<string>) => {
      const task = state.tasks[action.payload];
      if (task) {
        task.status = 'done';
        task.progress = 100;
        // Optionally remove after a short delay or let UI component unmount
      }
    },
    failUpload: (state, action: PayloadAction<string>) => {
      const task = state.tasks[action.payload];
      if (task) {
        task.status = 'failed';
      }
    },
    removeUploadTask: (state, action: PayloadAction<string>) => {
      delete state.tasks[action.payload];
    },
  },
});

export const { startUpload, updateProgress, completeUpload, failUpload, removeUploadTask } = uploadSlice.actions;
export default uploadSlice.reducer;
