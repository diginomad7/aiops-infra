import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Типы для состояния интерфейса
export type ThemeMode = 'light' | 'dark' | 'system';
export type SidebarState = 'expanded' | 'collapsed';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  autoHideDuration?: number;
}

// Начальное состояние
interface UIState {
  themeMode: ThemeMode;
  sidebarState: SidebarState;
  notifications: Notification[];
  isSettingsOpen: boolean;
  isRefreshing: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  isHelpOpen: boolean;
}

const initialState: UIState = {
  themeMode: 'system',
  sidebarState: 'expanded',
  notifications: [],
  isSettingsOpen: false,
  isRefreshing: false,
  autoRefresh: true,
  refreshInterval: 30000, // 30 секунд
  isHelpOpen: false,
};

// Слайс Redux
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Управление темой
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    
    // Управление боковой панелью
    setSidebarState(state, action: PayloadAction<SidebarState>) {
      state.sidebarState = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarState = state.sidebarState === 'expanded' ? 'collapsed' : 'expanded';
    },
    
    // Управление уведомлениями
    addNotification(state, action: PayloadAction<Omit<Notification, 'id'>>) {
      const id = Date.now().toString();
      state.notifications.push({
        id,
        ...action.payload,
      });
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter(notification => notification.id !== action.payload);
    },
    clearAllNotifications(state) {
      state.notifications = [];
    },
    
    // Управление диалогом настроек
    toggleSettings(state) {
      state.isSettingsOpen = !state.isSettingsOpen;
    },
    setSettingsOpen(state, action: PayloadAction<boolean>) {
      state.isSettingsOpen = action.payload;
    },
    
    // Управление диалогом справки
    toggleHelp(state) {
      state.isHelpOpen = !state.isHelpOpen;
    },
    setHelpOpen(state, action: PayloadAction<boolean>) {
      state.isHelpOpen = action.payload;
    },
    
    // Управление обновлением данных
    setIsRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setAutoRefresh(state, action: PayloadAction<boolean>) {
      state.autoRefresh = action.payload;
    },
    setRefreshInterval(state, action: PayloadAction<number>) {
      state.refreshInterval = action.payload;
    },
  },
});

export const {
  setThemeMode,
  setSidebarState,
  toggleSidebar,
  addNotification,
  removeNotification,
  clearAllNotifications,
  toggleSettings,
  setSettingsOpen,
  toggleHelp,
  setHelpOpen,
  setIsRefreshing,
  setAutoRefresh,
  setRefreshInterval,
} = uiSlice.actions;

export default uiSlice.reducer; 