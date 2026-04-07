import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchEntries = createAsyncThunk(
  'entries/fetchEntries',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/entries', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch entries');
    }
  }
);

export const createEntry = createAsyncThunk(
  'entries/createEntry',
  async (entryData, { rejectWithValue }) => {
    try {
      const response = await api.post('/entries', entryData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create entry');
    }
  }
);

export const updateEntry = createAsyncThunk(
  'entries/updateEntry',
  async ({ id, ...entryData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/entries/${id}`, entryData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update entry');
    }
  }
);

export const deleteEntry = createAsyncThunk(
  'entries/deleteEntry',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/entries/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete entry');
    }
  }
);

const initialState = {
  entries: [],
  currentEntry: null,
  pagination: null,
  loading: false,
  error: null
};

const entriesSlice = createSlice({
  name: 'entries',
  initialState,
  reducers: {
    setCurrentEntry: (state, action) => {
      state.currentEntry = action.payload;
    },
    clearCurrentEntry: (state) => {
      state.currentEntry = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch entries
      .addCase(fetchEntries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEntries.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create entry
      .addCase(createEntry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEntry.fulfilled, (state, action) => {
        state.loading = false;
        state.entries.unshift(action.payload.data);
      })
      .addCase(createEntry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update entry
      .addCase(updateEntry.fulfilled, (state, action) => {
        const index = state.entries.findIndex(e => e._id === action.payload.data._id);
        if (index !== -1) {
          state.entries[index] = action.payload.data;
        }
        if (state.currentEntry?._id === action.payload.data._id) {
          state.currentEntry = action.payload.data;
        }
      })
      // Delete entry
      .addCase(deleteEntry.fulfilled, (state, action) => {
        state.entries = state.entries.filter(e => e._id !== action.payload);
        if (state.currentEntry?._id === action.payload) {
          state.currentEntry = null;
        }
      });
  }
});

export const { setCurrentEntry, clearCurrentEntry, clearError } = entriesSlice.actions;
export default entriesSlice.reducer;
