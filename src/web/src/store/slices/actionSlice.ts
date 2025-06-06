import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Action, ActionQueryParams, ActionsResponse, ActionPlan } from '../../types/api';
import { actionAPI } from '../../api/api';

// Начальное состояние
interface ActionState {
  actions: Action[];
  selectedAction: Action | null;
  loading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  filters: ActionQueryParams;
}

const initialState: ActionState = {
  actions: [],
  selectedAction: null,
  loading: false,
  error: null,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {},
};

// Асинхронные действия
export const fetchActions = createAsyncThunk(
  'action/fetchActions',
  async (params: ActionQueryParams, { rejectWithValue }) => {
    try {
      return await actionAPI.getActions(params);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось загрузить действия');
    }
  }
);

export const fetchActionById = createAsyncThunk(
  'action/fetchActionById',
  async (id: string, { rejectWithValue }) => {
    try {
      return await actionAPI.getActionById(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось загрузить действие');
    }
  }
);

export const executeAction = createAsyncThunk(
  'action/executeAction',
  async (action: Omit<Action, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'completedAt' | 'result'>, { rejectWithValue }) => {
    try {
      return await actionAPI.executeAction(action);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось выполнить действие');
    }
  }
);

export const cancelAction = createAsyncThunk(
  'action/cancelAction',
  async (id: string, { rejectWithValue }) => {
    try {
      return await actionAPI.cancelAction(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось отменить действие');
    }
  }
);

export const executeActionPlan = createAsyncThunk(
  'action/executeActionPlan',
  async (plan: Omit<ActionPlan, 'id' | 'status' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      return await actionAPI.executeActionPlan(plan);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Не удалось выполнить план действий');
    }
  }
);

// Слайс Redux
const actionSlice = createSlice({
  name: 'action',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<ActionQueryParams>) {
      state.filters = action.payload;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
    },
    clearSelectedAction(state) {
      state.selectedAction = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Обработка fetchActions
      .addCase(fetchActions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActions.fulfilled, (state, action: PayloadAction<ActionsResponse>) => {
        state.loading = false;
        state.actions = action.payload.actions;
        state.totalCount = action.payload.total;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
      })
      .addCase(fetchActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка fetchActionById
      .addCase(fetchActionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionById.fulfilled, (state, action: PayloadAction<Action>) => {
        state.loading = false;
        state.selectedAction = action.payload;
      })
      .addCase(fetchActionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка executeAction
      .addCase(executeAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeAction.fulfilled, (state, action: PayloadAction<Action>) => {
        state.loading = false;
        state.actions.unshift(action.payload); // Добавляем новое действие в начало списка
        state.totalCount += 1;
      })
      .addCase(executeAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка cancelAction
      .addCase(cancelAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelAction.fulfilled, (state, action: PayloadAction<Action>) => {
        state.loading = false;
        const index = state.actions.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.actions[index] = action.payload;
        }
        if (state.selectedAction?.id === action.payload.id) {
          state.selectedAction = action.payload;
        }
      })
      .addCase(cancelAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Обработка executeActionPlan
      .addCase(executeActionPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeActionPlan.fulfilled, (state, action: PayloadAction<ActionPlan>) => {
        state.loading = false;
        // Добавляем действия из плана в список действий
        if (action.payload.actions && action.payload.actions.length > 0) {
          state.actions = [...action.payload.actions, ...state.actions];
          state.totalCount += action.payload.actions.length;
        }
      })
      .addCase(executeActionPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, setPage, setPageSize, clearSelectedAction } = actionSlice.actions;

export default actionSlice.reducer; 