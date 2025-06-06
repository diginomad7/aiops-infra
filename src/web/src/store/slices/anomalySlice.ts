import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Anomaly, AnomalyQueryParams, AnomaliesResponse } from '../../types/api';
import { anomalyAPI } from '../../api/api';

// Начальное состояние
interface AnomalyState {
  anomalies: Anomaly[];
  selectedAnomaly: Anomaly | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  filters: AnomalyQueryParams;
}

const initialState: AnomalyState = {
  anomalies: [],
  selectedAnomaly: null,
  loading: false,
  error: null,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {},
};

// Асинхронные действия
export const fetchAnomalies = createAsyncThunk(
  'anomaly/fetchAnomalies',
  async (params: AnomalyQueryParams, { rejectWithValue }) => {
    try {
      return await anomalyAPI.getAnomalies(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось загрузить аномалии');
    }
  }
);

export const fetchAnomalyById = createAsyncThunk(
  'anomaly/fetchAnomalyById',
  async (id: string, { rejectWithValue }) => {
    try {
      return await anomalyAPI.getAnomalyById(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось загрузить аномалию');
    }
  }
);

export const acknowledgeAnomaly = createAsyncThunk(
  'anomaly/acknowledgeAnomaly',
  async (id: string, { rejectWithValue }) => {
    try {
      return await anomalyAPI.acknowledgeAnomaly(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось подтвердить аномалию');
    }
  }
);

export const resolveAnomaly = createAsyncThunk(
  'anomaly/resolveAnomaly',
  async (id: string, { rejectWithValue }) => {
    try {
      return await anomalyAPI.resolveAnomaly(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось разрешить аномалию');
    }
  }
);

// Слайс Redux
const anomalySlice = createSlice({
  name: 'anomaly',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<AnomalyQueryParams>) {
      state.filters = action.payload;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
    },
    clearSelectedAnomaly(state) {
      state.selectedAnomaly = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Обработка fetchAnomalies
      .addCase(fetchAnomalies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnomalies.fulfilled, (state, action: PayloadAction<AnomaliesResponse>) => {
        state.loading = false;
        state.anomalies = action.payload.anomalies;
        state.totalCount = action.payload.total;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
      })
      .addCase(fetchAnomalies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка fetchAnomalyById
      .addCase(fetchAnomalyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnomalyById.fulfilled, (state, action: PayloadAction<Anomaly>) => {
        state.loading = false;
        state.selectedAnomaly = action.payload;
      })
      .addCase(fetchAnomalyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка acknowledgeAnomaly
      .addCase(acknowledgeAnomaly.fulfilled, (state, action: PayloadAction<Anomaly>) => {
        const index = state.anomalies.findIndex(anomaly => anomaly.id === action.payload.id);
        if (index !== -1) {
          state.anomalies[index] = action.payload;
        }
        if (state.selectedAnomaly?.id === action.payload.id) {
          state.selectedAnomaly = action.payload;
        }
      })
      
      // Обработка resolveAnomaly
      .addCase(resolveAnomaly.fulfilled, (state, action: PayloadAction<Anomaly>) => {
        const index = state.anomalies.findIndex(anomaly => anomaly.id === action.payload.id);
        if (index !== -1) {
          state.anomalies[index] = action.payload;
        }
        if (state.selectedAnomaly?.id === action.payload.id) {
          state.selectedAnomaly = action.payload;
        }
      });
  },
});

export const { setFilters, setPage, setPageSize, clearSelectedAnomaly } = anomalySlice.actions;

export default anomalySlice.reducer; 