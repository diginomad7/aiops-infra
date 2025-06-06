import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketManager, WebSocketConfig, ConnectionStatus } from '../utils/WebSocketManager';

/**
 * Main WebSocket hook for connection management
 */
export const useWebSocket = (config: WebSocketConfig) => {
  const wsManager = useRef<WebSocketManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});

  // Initialize WebSocket manager
  useEffect(() => {
    wsManager.current = new WebSocketManager(config);

    // Setup event listeners
    const removeStatusListener = wsManager.current.addEventListener('statusChange', (event) => {
      setStatus(event.to);
    });

    const removeErrorListener = wsManager.current.addEventListener('error', (event) => {
      setError(event.message);
    });

    const removeConnectedListener = wsManager.current.addEventListener('connected', () => {
      setError(null);
    });

    // Connect on mount
    wsManager.current.connect().catch((err) => {
      setError(err.message);
    });

    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (wsManager.current) {
        setStats(wsManager.current.getStats());
      }
    }, 5000);

    // Cleanup on unmount
    return () => {
      clearInterval(statsInterval);
      removeStatusListener();
      removeErrorListener();
      removeConnectedListener();
      
      if (wsManager.current) {
        wsManager.current.disconnect();
        wsManager.current = null;
      }
    };
  }, [config.url]);

  const subscribe = useCallback((topic: string, callback: (data: any) => void) => {
    return wsManager.current?.subscribe(topic, callback) || (() => {});
  }, []);

  const send = useCallback((message: any) => {
    return wsManager.current?.send(message) || false;
  }, []);

  const reconnect = useCallback(() => {
    if (wsManager.current) {
      wsManager.current.connect().catch((err) => {
        setError(err.message);
      });
    }
  }, []);

  return {
    status,
    error,
    stats,
    subscribe,
    send,
    reconnect,
    isConnected: status === 'connected'
  };
};

/**
 * Hook for real-time detector updates
 */
export const useRealTimeDetector = (detectorId?: string) => {
  const [detectorStatus, setDetectorStatus] = useState<string>('unknown');
  const [detectorMetrics, setDetectorMetrics] = useState<any>({});
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const wsConfig = {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api/ws'
  };

  const { subscribe, isConnected, status } = useWebSocket(wsConfig);

  useEffect(() => {
    if (!detectorId || !isConnected) {
      return;
    }

    // Subscribe to detector-specific updates
    const unsubscribeStatus = subscribe(`detector.${detectorId}.status`, (data) => {
      setDetectorStatus(data.status);
      setLastUpdate(Date.now());
    });

    const unsubscribeMetrics = subscribe(`detector.${detectorId}.metrics`, (data) => {
      setDetectorMetrics(data);
      setLastUpdate(Date.now());
    });

    const unsubscribeHealth = subscribe(`detector.${detectorId}.health`, (data) => {
      setDetectorMetrics(prev => ({ ...prev, health: data }));
      setLastUpdate(Date.now());
    });

    // Store unsubscribe functions
    unsubscribeRef.current = () => {
      unsubscribeStatus();
      unsubscribeMetrics();
      unsubscribeHealth();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [detectorId, isConnected, subscribe]);

  // Subscribe to all detector updates when no specific detector is selected
  useEffect(() => {
    if (detectorId || !isConnected) {
      return;
    }

    const unsubscribeAll = subscribe('detectors', (data) => {
      // Handle bulk detector updates
      if (data.type === 'status_update') {
        setDetectorStatus(data.status);
        setLastUpdate(Date.now());
      } else if (data.type === 'metrics_update') {
        setDetectorMetrics(data.metrics);
        setLastUpdate(Date.now());
      }
    });

    unsubscribeRef.current = unsubscribeAll;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [detectorId, isConnected, subscribe]);

  return {
    detectorStatus,
    detectorMetrics,
    lastUpdate,
    isConnected,
    connectionStatus: status
  };
};

/**
 * Hook for real-time anomaly notifications
 */
export const useRealTimeAnomalies = () => {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [newAnomalyCount, setNewAnomalyCount] = useState<number>(0);
  const [lastAnomalyTime, setLastAnomalyTime] = useState<number>(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const wsConfig = {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api/ws'
  };

  const { subscribe, isConnected, status } = useWebSocket(wsConfig);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // Subscribe to anomaly notifications
    const unsubscribeAnomalies = subscribe('anomalies', (data) => {
      const anomaly = {
        ...data,
        id: data.id || `anomaly_${Date.now()}`,
        timestamp: data.timestamp || Date.now(),
        read: false
      };

      setAnomalies(prev => [anomaly, ...prev.slice(0, 99)]); // Keep last 100 anomalies
      setNewAnomalyCount(prev => prev + 1);
      setLastAnomalyTime(Date.now());
    });

    // Subscribe to critical anomalies
    const unsubscribeCritical = subscribe('anomalies.critical', (data) => {
      const criticalAnomaly = {
        ...data,
        id: data.id || `critical_${Date.now()}`,
        timestamp: data.timestamp || Date.now(),
        severity: 'critical',
        read: false
      };

      setAnomalies(prev => [criticalAnomaly, ...prev.slice(0, 99)]);
      setNewAnomalyCount(prev => prev + 1);
      setLastAnomalyTime(Date.now());

      // Show system notification for critical anomalies
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Critical Anomaly Detected', {
          body: data.message || 'A critical anomaly has been detected',
          icon: '/favicon.ico',
          tag: 'critical-anomaly'
        });
      }
    });

    unsubscribeRef.current = () => {
      unsubscribeAnomalies();
      unsubscribeCritical();
    };

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isConnected, subscribe]);

  // Mark anomaly as read
  const markAsRead = useCallback((anomalyId: string) => {
    setAnomalies(prev => 
      prev.map(anomaly => 
        anomaly.id === anomalyId 
          ? { ...anomaly, read: true }
          : anomaly
      )
    );
    
    // Decrease new anomaly count
    setNewAnomalyCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all anomalies as read
  const markAllAsRead = useCallback(() => {
    setAnomalies(prev => prev.map(anomaly => ({ ...anomaly, read: true })));
    setNewAnomalyCount(0);
  }, []);

  // Clear all anomalies
  const clearAnomalies = useCallback(() => {
    setAnomalies([]);
    setNewAnomalyCount(0);
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  return {
    anomalies,
    newAnomalyCount,
    lastAnomalyTime,
    isConnected,
    connectionStatus: status,
    markAsRead,
    markAllAsRead,
    clearAnomalies,
    requestNotificationPermission,
    unreadAnomalies: anomalies.filter(a => !a.read),
    criticalAnomalies: anomalies.filter(a => a.severity === 'critical')
  };
};

/**
 * Hook for WebSocket connection status and health monitoring
 */
export const useWebSocketHealth = () => {
  const [connectionHealth, setConnectionHealth] = useState({
    isHealthy: false,
    latency: 0,
    reconnectAttempts: 0,
    lastConnected: 0,
    uptime: 0
  });

  const wsConfig = {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api/ws'
  };

  const { stats, status, isConnected } = useWebSocket(wsConfig);

  useEffect(() => {
    setConnectionHealth({
      isHealthy: isConnected && status === 'connected',
      latency: stats.connectionTime || 0,
      reconnectAttempts: stats.reconnectAttempts || 0,
      lastConnected: stats.lastHeartbeat || 0,
      uptime: stats.lastHeartbeat ? Date.now() - stats.lastHeartbeat : 0
    });
  }, [stats, status, isConnected]);

  return {
    ...connectionHealth,
    status,
    subscriptions: stats.subscriptions || [],
    rawStats: stats
  };
};