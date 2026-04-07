import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchConnections = createAsyncThunk(
  'connections/fetchConnections',
  async (status, { rejectWithValue }) => {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/connections', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch connections');
    }
  }
);

export const acceptConnection = createAsyncThunk(
  'connections/acceptConnection',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.post(`/connections/${id}/accept`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to accept connection');
    }
  }
);

export const declineConnection = createAsyncThunk(
  'connections/declineConnection',
  async (id, { rejectWithValue }) => {
    try {
      await api.post(`/connections/${id}/decline`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to decline connection');
    }
  }
);

const initialState = {
  connections: [],
  pending: [],
  active: [],
  loading: false,
  error: null
};

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    addResonance: (state, action) => {
      // Add new resonance notification
      const exists = state.pending.some(c => c._id === action.payload.connectionId);
      if (!exists) {
        state.pending.unshift({
          _id: action.payload.connectionId,
          bridgeMessage: action.payload.bridgeMessage,
          similarityScore: action.payload.similarityScore,
          status: 'pending'
        });
      }
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConnections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConnections.fulfilled, (state, action) => {
        state.loading = false;
        state.connections = action.payload.data;
        state.pending = action.payload.data.filter(c => c.status === 'pending');
        state.active = action.payload.data.filter(c => 
          c.status === 'accepted' || c.status === 'completed'
        );
      })
      .addCase(fetchConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(acceptConnection.fulfilled, (state, action) => {
        const connection = action.payload.data;
        const index = state.connections.findIndex(c => c._id === connection._id);
        if (index !== -1) {
          state.connections[index] = connection;
        }
        state.pending = state.connections.filter(c => c.status === 'pending');
        state.active = state.connections.filter(c => 
          c.status === 'accepted' || c.status === 'completed'
        );
      })
      .addCase(declineConnection.fulfilled, (state, action) => {
        state.connections = state.connections.filter(c => c._id !== action.payload);
        state.pending = state.pending.filter(c => c._id !== action.payload);
      });
  }
});

export const { addResonance, clearError } = connectionsSlice.actions;
export default connectionsSlice.reducer;
