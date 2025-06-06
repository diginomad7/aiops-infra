import { Middleware, MiddlewareAPI, Dispatch, AnyAction } from '@reduxjs/toolkit';
import { WebSocketManager, WebSocketMessage } from '../../utils/WebSocketManager';
import { RootState } from '../store';
import { detectorSlice } from '../slices/detectorSlice';

// WebSocket action types
export const WS_CONNECT = 'websocket/connect';
export const WS_DISCONNECT = 'websocket/disconnect';
export const WS_CONNECTED = 'websocket/connected';
export const WS_DISCONNECTED = 'websocket/disconnected';
export const WS_ERROR = 'websocket/error';
export const WS_MESSAGE = 'websocket/message';

// Optimistic update tracking
interface OptimisticUpdate {
  id: string;
  originalAction: AnyAction;
  rollbackAction: AnyAction;
  timestamp: number;
}

/**
 * Redux WebSocket Middleware
 * 
 * Features:
 * - WebSocket connection management
 * - Event → Redux action mapping
 * - Optimistic updates with rollback
 * - Automatic state synchronization
 * - Error handling and recovery
 */
export const createWebSocketMiddleware = (): Middleware => {
  let wsManager: WebSocketManager | null = null;
  let pendingUpdates: Map<string, OptimisticUpdate> = new Map();
  let updateCounter = 0;

  return (store: MiddlewareAPI<Dispatch, RootState>) => (next: Dispatch) => (action: AnyAction) => {
    
    switch (action.type) {
      case WS_CONNECT:
        if (wsManager) {
          wsManager.disconnect();
        }

        wsManager = new WebSocketManager({
          url: action.payload.url || process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api/ws',
          reconnectInterval: 5000,
          maxReconnectAttempts: 10,
          heartbeatInterval: 30000,
          connectionTimeout: 10000
        });

        // Setup WebSocket event handlers
        setupWebSocketHandlers(wsManager, store);

        // Connect to WebSocket
        wsManager.connect()
          .then(() => {
            store.dispatch({ type: WS_CONNECTED });
          })
          .catch((error) => {
            store.dispatch({ 
              type: WS_ERROR, 
              payload: { message: error.message } 
            });
          });
        break;

      case WS_DISCONNECT:
        if (wsManager) {
          wsManager.disconnect();
          wsManager = null;
        }
        store.dispatch({ type: WS_DISCONNECTED });
        break;

      // Handle optimistic updates for detector operations
      case 'detectors/startDetector/pending':
      case 'detectors/stopDetector/pending':
      case 'detectors/updateDetector/pending':
        return handleOptimisticUpdate(action, store, next, pendingUpdates);

      case 'detectors/startDetector/fulfilled':
      case 'detectors/stopDetector/fulfilled':
      case 'detectors/updateDetector/fulfilled':
        return handleOptimisticConfirmation(action, store, next, pendingUpdates);

      case 'detectors/startDetector/rejected':
      case 'detectors/stopDetector/rejected':
      case 'detectors/updateDetector/rejected':
        return handleOptimisticRollback(action, store, next, pendingUpdates);

      default:
        return next(action);
    }

    return next(action);
  };

  function setupWebSocketHandlers(
    wsManager: WebSocketManager,
    store: MiddlewareAPI<Dispatch, RootState>
  ) {
    // Handle connection events
    wsManager.addEventListener('connected', () => {
      store.dispatch({ type: WS_CONNECTED });
      
      // Subscribe to detector events
      wsManager.subscribe('detectors', (data) => {
        handleDetectorMessage(data, store);
      });

      wsManager.subscribe('anomalies', (data) => {
        handleAnomalyMessage(data, store);
      });

      // Subscribe to individual detector updates
      const state = store.getState();
      const detectorIds = state.detectors.detectors.map(d => d.id);
      
      detectorIds.forEach(detectorId => {
        wsManager.subscribe(`detector.${detectorId}.status`, (data) => {
          store.dispatch(detectorSlice.actions.updateDetectorStatus({
            id: detectorId,
            status: data.status
          }));
        });

        wsManager.subscribe(`detector.${detectorId}.metrics`, (data) => {
          store.dispatch(detectorSlice.actions.updateDetectorMetrics({
            id: detectorId,
            metrics: data
          }));
        });
      });
    });

    wsManager.addEventListener('disconnected', () => {
      store.dispatch({ type: WS_DISCONNECTED });
    });

    wsManager.addEventListener('error', (event) => {
      store.dispatch({ 
        type: WS_ERROR, 
        payload: { message: event.message } 
      });
    });

    wsManager.addEventListener('message', (message: WebSocketMessage) => {
      store.dispatch({ 
        type: WS_MESSAGE, 
        payload: message 
      });
    });
  }

  function handleDetectorMessage(data: any, store: MiddlewareAPI<Dispatch, RootState>) {
    switch (data.type) {
      case 'detector_created':
        store.dispatch(detectorSlice.actions.addDetector(data.detector));
        break;

      case 'detector_updated':
        store.dispatch(detectorSlice.actions.updateDetector(data.detector));
        break;

      case 'detector_deleted':
        store.dispatch(detectorSlice.actions.removeDetector(data.detectorId));
        break;

      case 'detector_status_changed':
        store.dispatch(detectorSlice.actions.updateDetectorStatus({
          id: data.detectorId,
          status: data.status
        }));
        break;

      case 'detector_metrics_updated':
        store.dispatch(detectorSlice.actions.updateDetectorMetrics({
          id: data.detectorId,
          metrics: data.metrics
        }));
        break;

      default:
        console.warn('Unknown detector message type:', data.type);
    }
  }

  function handleAnomalyMessage(data: any, store: MiddlewareAPI<Dispatch, RootState>) {
    // Handle anomaly notifications
    const anomaly = {
      id: data.id || `anomaly_${Date.now()}`,
      detectorId: data.detectorId,
      timestamp: data.timestamp || Date.now(),
      severity: data.severity || 'medium',
      message: data.message,
      value: data.value,
      threshold: data.threshold,
      ...data
    };

    // Add anomaly to detector state
    store.dispatch(detectorSlice.actions.addAnomaly(anomaly));

    // Show notification for critical anomalies
    if (data.severity === 'critical') {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Critical Anomaly Detected', {
          body: data.message || 'A critical anomaly has been detected',
          icon: '/favicon.ico',
          tag: 'critical-anomaly'
        });
      }
    }
  }

  function handleOptimisticUpdate(
    action: AnyAction,
    store: MiddlewareAPI<Dispatch, RootState>,
    next: Dispatch,
    pendingUpdates: Map<string, OptimisticUpdate>
  ) {
    const updateId = `update_${++updateCounter}`;
    const state = store.getState();

    // Create optimistic update based on action type
    let optimisticAction: AnyAction | null = null;
    let rollbackAction: AnyAction | null = null;

    if (action.type === 'detectors/startDetector/pending') {
      const detectorId = action.meta.arg;
      const currentDetector = state.detectors.detectors.find(d => d.id === detectorId);
      
      if (currentDetector) {
        // Optimistically update to 'starting' status
        optimisticAction = detectorSlice.actions.updateDetectorStatus({
          id: detectorId,
          status: 'starting'
        });

        // Rollback to original status
        rollbackAction = detectorSlice.actions.updateDetectorStatus({
          id: detectorId,
          status: currentDetector.status
        });
      }
    } else if (action.type === 'detectors/stopDetector/pending') {
      const detectorId = action.meta.arg;
      const currentDetector = state.detectors.detectors.find(d => d.id === detectorId);
      
      if (currentDetector) {
        // Optimistically update to 'stopping' status
        optimisticAction = detectorSlice.actions.updateDetectorStatus({
          id: detectorId,
          status: 'stopping'
        });

        // Rollback to original status
        rollbackAction = detectorSlice.actions.updateDetectorStatus({
          id: detectorId,
          status: currentDetector.status
        });
      }
    } else if (action.type === 'detectors/updateDetector/pending') {
      const { id, updates } = action.meta.arg;
      const currentDetector = state.detectors.detectors.find(d => d.id === id);
      
      if (currentDetector) {
        // Optimistically apply updates
        optimisticAction = detectorSlice.actions.updateDetector({
          ...currentDetector,
          ...updates,
          status: 'updating'
        });

        // Rollback to original detector
        rollbackAction = detectorSlice.actions.updateDetector(currentDetector);
      }
    }

    // Store optimistic update for potential rollback
    if (optimisticAction && rollbackAction) {
      pendingUpdates.set(updateId, {
        id: updateId,
        originalAction: action,
        rollbackAction,
        timestamp: Date.now()
      });

      // Set update ID in action meta for tracking
      action.meta = { ...action.meta, updateId };

      // Apply optimistic update
      store.dispatch(optimisticAction);
    }

    return next(action);
  }

  function handleOptimisticConfirmation(
    action: AnyAction,
    store: MiddlewareAPI<Dispatch, RootState>,
    next: Dispatch,
    pendingUpdates: Map<string, OptimisticUpdate>
  ) {
    const updateId = action.meta?.requestId;
    
    if (updateId && pendingUpdates.has(updateId)) {
      // Remove pending update as it was successful
      pendingUpdates.delete(updateId);
    }

    return next(action);
  }

  function handleOptimisticRollback(
    action: AnyAction,
    store: MiddlewareAPI<Dispatch, RootState>,
    next: Dispatch,
    pendingUpdates: Map<string, OptimisticUpdate>
  ) {
    const updateId = action.meta?.requestId;
    
    if (updateId && pendingUpdates.has(updateId)) {
      const pendingUpdate = pendingUpdates.get(updateId)!;
      
      // Apply rollback action
      store.dispatch(pendingUpdate.rollbackAction);
      
      // Remove pending update
      pendingUpdates.delete(updateId);
      
      console.warn('Optimistic update rolled back:', {
        updateId,
        error: action.payload,
        timestamp: Date.now() - pendingUpdate.timestamp
      });
    }

    return next(action);
  }
};

// Action creators for WebSocket operations
export const websocketActions = {
  connect: (url?: string) => ({
    type: WS_CONNECT,
    payload: { url }
  }),

  disconnect: () => ({
    type: WS_DISCONNECT
  }),

  send: (message: WebSocketMessage) => ({
    type: 'websocket/send',
    payload: message
  })
};

// WebSocket state reducer
export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempts: number;
}

const initialState: WebSocketState = {
  connected: false,
  connecting: false,
  error: null,
  lastMessage: null,
  reconnectAttempts: 0
};

export const websocketReducer = (
  state = initialState,
  action: AnyAction
): WebSocketState => {
  switch (action.type) {
    case WS_CONNECT:
      return {
        ...state,
        connecting: true,
        error: null
      };

    case WS_CONNECTED:
      return {
        ...state,
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0
      };

    case WS_DISCONNECTED:
      return {
        ...state,
        connected: false,
        connecting: false
      };

    case WS_ERROR:
      return {
        ...state,
        connected: false,
        connecting: false,
        error: action.payload.message,
        reconnectAttempts: state.reconnectAttempts + 1
      };

    case WS_MESSAGE:
      return {
        ...state,
        lastMessage: action.payload
      };

    default:
      return state;
  }
}; 