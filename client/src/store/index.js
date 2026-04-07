import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import entriesReducer from './entriesSlice';
import connectionsReducer from './connectionsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    entries: entriesReducer,
    connections: connectionsReducer
  }
});
