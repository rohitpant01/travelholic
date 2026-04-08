import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storyAPI } from '../../api/services';

export interface StoryItem {
  _id: string;
  user: any; // full user object
  mediaUrl: string;
  type: string;
  createdAt: string;
  viewsCount: number;
  isViewed?: boolean;
}

export interface StoryGroup {
  userId: string;
  username: string;
  profilePic: string;
  stories: StoryItem[];
  isAllViewed?: boolean;
}

export interface StoryState {
  groupedStories: StoryGroup[];
  loading: boolean;
  error: string | null;
}

const initialState: StoryState = {
  groupedStories: [],
  loading: false,
  error: null,
};

// Fetch stories from backend, flatten then regroup by user
export const fetchStories = createAsyncThunk(
  'stories/fetchStories',
  async (_, { rejectWithValue }) => {
    try {
      const res = await storyAPI.getStories();
      const stories = res.data?.stories || [];
      const flat: StoryItem[] = stories.flatMap((group: any) =>
        (group.items || []).map((item: any) => ({
          _id: item._id,
          user: group.user,
          mediaUrl: item.mediaUrl,
          type: item.type,
          createdAt: item.createdAt,
          viewsCount: item.views ? item.views.length : 0,
          isViewed: item.isViewed,
        }))
      );
      // Regroup by user ID
      const groups: { [key: string]: StoryGroup } = {};
      flat.forEach(story => {
        const uid = story.user._id;
        if (!groups[uid]) {
          groups[uid] = {
            userId: uid,
            username: story.user.firstName || story.user.username || 'Traveler',
            profilePic: story.user.photos?.[0]?.url || '',
            stories: [],
            isAllViewed: true,
          };
        }
        groups[uid].stories.push(story);
        if (!story.isViewed) groups[uid].isAllViewed = false;
      });
      return Object.values(groups);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch stories');
    }
  }
);

// Create a new story (upload) and return a flat story item
export const createStoryAction = createAsyncThunk(
  'stories/createStory',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const res = await storyAPI.createStory(formData);
      const story = res.data.story;
      return {
        _id: story._id,
        user: story.userId,
        mediaUrl: story.mediaUrl,
        type: story.type,
        createdAt: story.createdAt,
        viewsCount: 0,
      } as StoryItem;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to add story');
    }
  }
);

export const deleteStoryAction = createAsyncThunk(
  'stories/deleteStory',
  async (storyId: string, { rejectWithValue }) => {
    try {
      await storyAPI.deleteStory(storyId);
      return storyId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete story');
    }
  }
);

// Fire and forget, no state mutations needed because users don't see view counts of stories they're viewing
export const addViewAction = createAsyncThunk(
  'stories/addView',
  async (storyId: string, { rejectWithValue }) => {
    try {
      await storyAPI.addView(storyId);
      return storyId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to add view');
    }
  }
);

const storySlice = createSlice({
  name: 'stories',
  initialState,
  reducers: {
    addLocalStory: (state, action) => {
      const newStory = action.payload as StoryItem;
      const uid = newStory.user._id;
      const existing = state.groupedStories.find(g => g.userId === uid);
      if (existing) {
        existing.stories.unshift(newStory);
      } else {
        state.groupedStories.unshift({
          userId: uid,
          username: newStory.user.name || newStory.user.username || 'User',
          profilePic: newStory.user.photos?.[0]?.url || '',
          stories: [newStory],
        });
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchStories.pending, state => {
        state.loading = true;
      })
      .addCase(fetchStories.fulfilled, (state, action) => {
        state.loading = false;
        state.groupedStories = action.payload as StoryGroup[];
      })
      .addCase(fetchStories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createStoryAction.fulfilled, (state, action) => {
        const newStory = action.payload as StoryItem;
        const uid = newStory.user._id;
        const existing = state.groupedStories.find(g => g.userId === uid);
        if (existing) {
          existing.stories.unshift(newStory);
        } else {
          state.groupedStories.unshift({
            userId: uid,
            username: newStory.user.name || newStory.user.username || 'User',
            profilePic: newStory.user.photos?.[0]?.url || '',
            stories: [newStory],
          });
        }
      })
      .addCase(deleteStoryAction.pending, (state, action) => {
        const storyId = action.meta.arg;
        state.groupedStories = (state.groupedStories || []).map(group => {
          return {
            ...group,
            stories: (group.stories || []).filter(s => s._id !== storyId)
          };
        }).filter(group => group.stories && group.stories.length > 0);
      })
      .addCase(addViewAction.fulfilled, (state, action) => {
        const storyId = action.payload;
        // Optimistically mark as viewed
        state.groupedStories = state.groupedStories.map(group => {
          let allViewed = true;
          const updatedStories = group.stories.map(s => {
            if (s._id === storyId) {
              return { ...s, isViewed: true };
            }
            if (!s.isViewed) allViewed = false;
            return s;
          });

          return {
            ...group,
            stories: updatedStories,
            isAllViewed: allViewed
          };
        });
      });
  },
});

export const { addLocalStory } = storySlice.actions;
export default storySlice.reducer;
