import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { feedAPI } from '../../api/services';
import { startUpload, updateProgress, completeUpload, failUpload } from './uploadSlice';

export interface Post {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    photos: { url: string; isProfile: boolean }[];
    age?: number;
    city?: string;
    country?: string;
  };
  content: string;
  images: string[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  placeName?: string;
  allowAIItinerary?: boolean;
  createdAt: string;
}

interface FeedState {
  posts: Post[];
  userPosts: Post[];
  loading: boolean;
  error: string | null;
  mode: 'nearby' | 'friends' | 'global';
  page: number;
  hasMore: boolean;
}

export const fetchFeed = createAsyncThunk(
  'feed/fetchFeed',
  async ({ mode, page }: { mode: string; page: number }, { rejectWithValue }) => {
    try {
      const res = await feedAPI.getFeed(mode, page);
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch feed');
    }
  }
);

export const toggleLikeAction = createAsyncThunk(
  'feed/toggleLike',
  async (postId: string, { rejectWithValue, getState }) => {
    // Prevent rapid double-taps from causing state desync
    const state = getState() as { feed: FeedState };
    const post = state.feed.posts.find(p => p._id === postId);
    try {
      const res = await feedAPI.toggleLike(postId);
      return { postId, liked: res.data.liked, likesCount: res.data.likesCount };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to toggle like');
    }
  }
);

export const createPostAction = createAsyncThunk(
  'feed/createPost',
  async ({ formData, optimisticData, tempId }: { formData: FormData; optimisticData: any; tempId: string }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(startUpload({ id: tempId, type: 'post' }));
      const res = await feedAPI.createPost(formData, (progressEvent: any) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          dispatch(updateProgress({ id: tempId, progress: percent }));
        }
      });
      dispatch(completeUpload(tempId));
      return { post: res.data.post, tempId }; 
    } catch (err: any) {
      dispatch(failUpload(tempId));
      return rejectWithValue({ error: err.response?.data?.error || 'Failed to create post', tempId });
    }
  }
);

export const deletePostAction = createAsyncThunk(
  'feed/deletePost',
  async (postId: string, { rejectWithValue }) => {
    try {
      await feedAPI.deletePost(postId);
      return postId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to delete post');
    }
  }
);

export const editPostAction = createAsyncThunk(
  'feed/editPost',
  async ({ postId, data }: { postId: string; data: { content?: string; placeName?: string } }, { rejectWithValue }) => {
    try {
      const res = await feedAPI.editPost(postId, data);
      return res.data.post;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to edit post');
    }
  }
);

export const fetchSinglePost = createAsyncThunk(
  'feed/fetchSinglePost',
  async (postId: string, { rejectWithValue }) => {
    try {
      const res = await feedAPI.getPost(postId);
      return res.data.post;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch post');
    }
  }
);

export const fetchPostLikes = createAsyncThunk(
  'feed/fetchPostLikes',
  async (postId: string, { rejectWithValue }) => {
    try {
      const res = await feedAPI.getPostLikes(postId);
      return res.data.users;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch likes');
    }
  }
);

export const fetchUserPosts = createAsyncThunk(
  'feed/fetchUserPosts',
  async ({ userId, page }: { userId: string; page: number }, { rejectWithValue }) => {
    try {
      const res = await feedAPI.getUserPosts(userId, page);
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch user posts');
    }
  }
);

const feedSlice = createSlice({
  name: 'feed',
  initialState: {
    posts: [],
    userPosts: [],
    loading: false,
    error: null,
    mode: 'global',
    page: 1,
    hasMore: true,
  } as FeedState,
  reducers: {
    setMode: (state, action: PayloadAction<'nearby' | 'friends' | 'global'>) => {
      state.mode = action.payload;
      state.posts = [];
      state.page = 1;
      state.hasMore = true;
    },
    addPostToFeed: (state, action: PayloadAction<Post>) => {
      state.posts.unshift(action.payload);
    },
    addTempPost: (state, action: PayloadAction<any>) => {
      state.posts.unshift(action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
    incrementCommentCount: (state, action: PayloadAction<string>) => {
      const postId = action.payload;
      const feedPost = state.posts.find(p => p._id === postId);
      if (feedPost) feedPost.commentsCount += 1;
      const userPost = state.userPosts.find(p => p._id === postId);
      if (userPost) userPost.commentsCount += 1;
    },
    decrementCommentCount: (state, action: PayloadAction<string>) => {
      const postId = action.payload;
      const feedPost = state.posts.find(p => p._id === postId);
      if (feedPost) feedPost.commentsCount = Math.max(0, feedPost.commentsCount - 1);
      const userPost = state.userPosts.find(p => p._id === postId);
      if (userPost) userPost.commentsCount = Math.max(0, userPost.commentsCount - 1);
    },
    clearUserPosts: (state) => {
      state.userPosts = [];
    },
    updatePostInteraction: (state, action: PayloadAction<{
      postId: string;
      likesCount?: number;
      commentsCount?: number;
      type: string;
    }>) => {
      const { postId, likesCount, commentsCount, type } = action.payload;
      // Update in both posts (feed) and userPosts (profile)
      [state.posts, state.userPosts].forEach(list => {
        const post = list.find(p => p._id === postId);
        if (post) {
          if (typeof likesCount === 'number') post.likesCount = likesCount;
          if (typeof commentsCount === 'number') post.commentsCount = commentsCount;
        }
      });
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeed.pending, (state) => { 
        state.loading = true; 
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.loading = false;
        const newPosts = action.payload?.posts || [];
        
        if (action.meta.arg.page === 1) {
          state.posts = newPosts;
        } else {
          // Prevent duplicates
          const existingIds = state.posts.map(p => p._id);
          const uniqueNewPosts = newPosts.filter((p: Post) => !existingIds.includes(p._id));
          state.posts = [...state.posts, ...uniqueNewPosts];
        }
        
        state.page = action.payload?.page || state.page;
        state.hasMore = Array.isArray(newPosts) && newPosts.length > 0;
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        // If it's a server error (503/502) or rate limit (429), stop trying to load more to prevent infinite loop
        if (state.error?.includes('503') || state.error?.includes('502') || state.error?.includes('429')) {
          state.hasMore = false;
        }
      })
      .addCase(toggleLikeAction.pending, (state, action) => {
        const postId = action.meta.arg;
        const feedPost = state.posts.find(p => p._id === postId);
        if (feedPost) {
          feedPost.isLiked = !feedPost.isLiked;
          feedPost.likesCount = Math.max(0, feedPost.likesCount + (feedPost.isLiked ? 1 : -1));
        }
        const userPost = state.userPosts.find(p => p._id === postId);
        if (userPost) {
          userPost.isLiked = !userPost.isLiked;
          userPost.likesCount = Math.max(0, userPost.likesCount + (userPost.isLiked ? 1 : -1));
        }
      })
      .addCase(toggleLikeAction.fulfilled, (state, action) => {
        // Sync with server truth to fix any desync from rapid taps
        const { postId, liked, likesCount } = action.payload;
        const feedPost = state.posts.find(p => p._id === postId);
        if (feedPost) {
          feedPost.isLiked = liked;
          if (typeof likesCount === 'number') feedPost.likesCount = likesCount;
        }
        const userPost = state.userPosts.find(p => p._id === postId);
        if (userPost) {
          userPost.isLiked = liked;
          if (typeof likesCount === 'number') userPost.likesCount = likesCount;
        }
      })
      .addCase(toggleLikeAction.rejected, (state, action) => {
        // Revert optimistic update on failure
        const postId = action.meta.arg;
        const feedPost = state.posts.find(p => p._id === postId);
        if (feedPost) {
          feedPost.isLiked = !feedPost.isLiked;
          feedPost.likesCount = Math.max(0, feedPost.likesCount + (feedPost.isLiked ? 1 : -1));
        }
        const userPost = state.userPosts.find(p => p._id === postId);
        if (userPost) {
          userPost.isLiked = !userPost.isLiked;
          userPost.likesCount = Math.max(0, userPost.likesCount + (userPost.isLiked ? 1 : -1));
        }
      })
      .addCase(createPostAction.pending, (state, action) => {
        const { optimisticData, tempId } = action.meta.arg;
        const exists = state.posts.find(p => p._id === tempId);
        if (!exists) {
          const tempPost: any = {
            _id: tempId,
            isTemporary: true,
            status: 'uploading',
            content: optimisticData.content || '',
            images: optimisticData.images || [],
            likesCount: 0,
            commentsCount: 0,
            isLiked: false,
            createdAt: new Date().toISOString(),
            userId: optimisticData.user || { _id: 'me', firstName: 'You' }
          };
          state.posts.unshift(tempPost);
        }
      })
      .addCase(createPostAction.fulfilled, (state, action) => {
        const { post, tempId } = action.payload;
        const index = state.posts.findIndex(p => p._id === tempId);
        if (index !== -1) {
          state.posts[index] = post;
        } else {
          state.posts.unshift(post);
        }
      })
      .addCase(createPostAction.rejected, (state, action) => {
        const tempId = (action.payload as any)?.tempId || action.meta.arg.tempId;
        const index = state.posts.findIndex(p => p._id === tempId);
        if (index !== -1) {
          (state.posts[index] as any).status = 'failed';
        }
      })
      .addCase(deletePostAction.pending, (state, action) => {
        const postId = action.meta.arg;
        state.posts = state.posts.filter(p => p._id !== postId);
        state.userPosts = state.userPosts.filter(p => p._id !== postId);
      })
      .addCase(editPostAction.fulfilled, (state, action) => {
        const updatedPost = action.payload;
        const index = state.posts.findIndex(p => p._id === updatedPost._id);
        if (index !== -1) state.posts[index] = updatedPost;
        const uIndex = state.userPosts.findIndex(p => p._id === updatedPost._id);
        if (uIndex !== -1) state.userPosts[uIndex] = updatedPost;
      })
      .addCase(fetchSinglePost.fulfilled, (state, action) => {
        const fetchedPost = action.payload;
        if (!fetchedPost) return;
        const index = state.posts.findIndex(p => p._id === fetchedPost._id);
        if (index !== -1) {
          state.posts[index] = fetchedPost;
        } else {
          state.posts.push(fetchedPost);
        }
      })
      .addCase(fetchUserPosts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserPosts.fulfilled, (state, action) => {
        state.loading = false;
        const newPosts = action.payload?.posts || [];
        if (action.meta.arg.page === 1) {
          state.userPosts = newPosts;
        } else {
          const existingIds = state.userPosts.map(p => p._id);
          const uniqueNewPosts = newPosts.filter((p: Post) => !existingIds.includes(p._id));
          state.userPosts = [...state.userPosts, ...uniqueNewPosts];
        }
      })
      .addCase(fetchUserPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        // Prevent profile feed infinite loop on server error or rate limit
        if (state.error?.includes('503') || state.error?.includes('502') || state.error?.includes('429')) {
          state.hasMore = false; 
        }
      });
  }
});

export const { 
  setMode, 
  addPostToFeed, 
  addTempPost, 
  clearError, 
  incrementCommentCount, 
  decrementCommentCount,
  clearUserPosts,
  updatePostInteraction
} = feedSlice.actions;
export default feedSlice.reducer;
