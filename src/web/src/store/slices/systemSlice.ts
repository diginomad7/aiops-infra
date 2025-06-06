import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SystemStats } from '../../types/api';
import { systemAPI } from '../../api/api';

// Начальное состояние
interface SystemState {
  stats: SystemStats | null;
  healthStatus: string;
  loading: boolean;
  error: string | null;
}

const initialState: SystemState = {
  stats: null,
  healthStatus: 'unknown',
  loading: false,
  error: null,
};

// Асинхронные действия
export const fetchSystemStats = createAsyncThunk(
  'system/fetchSystemStats',
  async (_, { rejectWithValue }) => {
    try {
      return await systemAPI.getSystemStats();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось загрузить статистику системы');
    }
  }
);

export const checkSystemHealth = createAsyncThunk(
  'system/checkSystemHealth',
  async (_, { rejectWithValue }) => {
    try {
      return await systemAPI.checkHealth();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось проверить состояние системы');
    }
  }
);

// Слайс Redux
const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    resetSystemError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Обработка fetchSystemStats
      .addCase(fetchSystemStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemStats.fulfilled, (state, action: PayloadAction<SystemStats>) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchSystemStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка checkSystemHealth
      .addCase(checkSystemHealth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkSystemHealth.fulfilled, (state, action: PayloadAction<{ status: string }>) => {
        state.loading = false;
        state.healthStatus = action.payload.status;
      })
      .addCase(checkSystemHealth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.healthStatus = 'unhealthy';
      });
  },
});

export const { resetSystemError } = systemSlice.actions;

export default systemSlice.reducer; 