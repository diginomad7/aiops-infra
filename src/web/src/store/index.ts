import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import anomalyReducer from './slices/anomalySlice';
import detectorReducer from './slices/detectorSlice';
import actionReducer from './slices/actionSlice';
import systemReducer from './slices/systemSlice';
import uiReducer from './slices/uiSlice';
import { createWebSocketMiddleware, websocketReducer } from './middleware/websocketMiddleware';

// Настройка Redux хранилища
export const store = configureStore({
  reducer: {
    anomalies: anomalyReducer,
    detectors: detectorReducer,
    actions: actionReducer,
    system: systemReducer,
    ui: uiReducer,
    websocket: websocketReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем некоторые non-serializable значения в действиях и состоянии
        ignoredActions: [
          'payload.timestamp',
          'websocket/connect',
          'websocket/send',
          'websocket/message',
        ],
        ignoredPaths: ['websocket.lastMessage'],
      },
    }).concat(createWebSocketMiddleware()),
});

// Типизированные хуки для использования в компонентах
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store; 