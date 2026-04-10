import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchConnections = createAsyncThunk(
  'connections/fetchConnections',
  async (status, { rejectWithValue }) => {
    try {
      const params   = status ? { status } : {};
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

// Helper: recompute pending / active lists from all connections
function recomputeLists(state) {
  state.pending = state.connections.filter(c => c.status === 'pending');
  state.active  = state.connections.filter(c =>
    c.status === 'accepted' || c.status === 'completed' || c.status === 'resolved'
  );
}

const initialState = {
  connections: [],
  pending:     [],
  active:      [],
  loading:     false,
  error:       null
};

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    /**
     * Upsert a connection that arrived via a socket event.
     * Handles both new connections and updates to existing ones.
     *
     * The resonance payload from the server now includes full connection
     * data (seekerId/sageId with displayName, bridgeMessage, status, etc.)
     * so the card renders correctly without a round-trip to the API.
     */
    upsertConnection: (state, action) => {
      const incoming = action.payload;
      if (!incoming?._id) return;

      const idx = state.connections.findIndex(c => c._id === incoming._id);
      if (idx !== -1) {
        // Merge: keep existing fields if the incoming payload is a partial update
        state.connections[idx] = { ...state.connections[idx], ...incoming };
      } else {
        state.connections.unshift(incoming);
      }
      recomputeLists(state);
    },

    /**
     * Patch an existing connection's bridgeMessage + summary after the
     * background AI enrichment finishes (receives connection_enriched event).
     */
    enrichConnection: (state, action) => {
      const { connectionId, bridgeMessage, summary } = action.payload;
      const idx = state.connections.findIndex(c => c._id === connectionId);
      if (idx !== -1) {
        if (bridgeMessage) state.connections[idx].bridgeMessage      = bridgeMessage;
        if (summary)       state.connections[idx].theirEntrySummary  = summary;
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
        state.error   = null;
      })
      .addCase(fetchConnections.fulfilled, (state, action) => {
        state.loading     = false;
        state.connections = action.payload.data;
        recomputeLists(state);
      })
      .addCase(fetchConnections.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })
      .addCase(acceptConnection.fulfilled, (state, action) => {
        const connection = action.payload.data;
        const index      = state.connections.findIndex(c => c._id === connection._id);
        if (index !== -1) {
          state.connections[index] = connection;
        } else {
          state.connections.unshift(connection);
        }
        recomputeLists(state);
      })
      .addCase(declineConnection.fulfilled, (state, action) => {
        state.connections = state.connections.filter(c => c._id !== action.payload);
        recomputeLists(state);
      });
  }
});

export const { upsertConnection, enrichConnection, clearError } = connectionsSlice.actions;
export default connectionsSlice.reducer;
