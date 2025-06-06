import React, { useEffect, useState } from 'react';
import { useRealTimeAnomalies } from '../../hooks/useWebSocket';

interface AnomalyNotificationCenterProps {
  className?: string;
  maxNotifications?: number;
  autoHide?: boolean;
  autoHideDelay?: number;
}

interface NotificationToast {
  id: string;
  anomaly: any;
  timestamp: number;
  visible: boolean;
}

const AnomalyNotificationCenter: React.FC<AnomalyNotificationCenterProps> = ({
  className = '',
  maxNotifications = 5,
  autoHide = true,
  autoHideDelay = 10000
}) => {
  const { 
    anomalies, 
    newAnomalyCount, 
    isConnected, 
    markAsRead, 
    markAllAsRead,
    clearAnomalies,
    requestNotificationPermission,
    unreadAnomalies,
    criticalAnomalies
  } = useRealTimeAnomalies();

  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [showCenter, setShowCenter] = useState(false);

  // Handle new anomalies for toast notifications
  useEffect(() => {
    const latestAnomalies = anomalies.slice(0, 3); // Show max 3 toasts
    const newToasts = latestAnomalies
      .filter(anomaly => !toasts.some(toast => toast.anomaly.id === anomaly.id))
      .map(anomaly => ({
        id: anomaly.id,
        anomaly,
        timestamp: Date.now(),
        visible: true
      }));

    if (newToasts.length > 0) {
      setToasts(prev => [...newToasts, ...prev].slice(0, maxNotifications));
    }
  }, [anomalies, maxNotifications]);

  // Auto-hide toasts
  useEffect(() => {
    if (!autoHide) return;

    const timer = setInterval(() => {
      setToasts(prev => 
        prev.map(toast => {
          if (Date.now() - toast.timestamp > autoHideDelay) {
            return { ...toast, visible: false };
          }
          return toast;
        }).filter(toast => Date.now() - toast.timestamp <= autoHideDelay + 500)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [autoHide, autoHideDelay]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: '🚨'
        };
      case 'high':
        return {
          color: 'bg-orange-500',
          textColor: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: '⚠️'
        };
      case 'medium':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: '⚡'
        };
      default:
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: 'ℹ️'
        };
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  };

  return (
    <div className={className}>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowCenter(!showCenter)}
          className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
          title={`${newAnomalyCount} new anomalies`}
        >
          <span className="text-xl">🔔</span>
          
          {/* Badge */}
          {newAnomalyCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[1.25rem] h-5">
              {newAnomalyCount > 99 ? '99+' : newAnomalyCount}
            </span>
          )}
          
          {/* Connection Status */}
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
        </button>

        {/* Notification Center Dropdown */}
        {showCenter && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Anomaly Notifications
              </h3>
              <div className="flex items-center space-x-2">
                {newAnomalyCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowCenter(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Anomaly List */}
            <div className="max-h-80 overflow-y-auto">
              {anomalies.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No anomalies detected yet
                </div>
              ) : (
                anomalies.slice(0, 20).map((anomaly) => {
                  const config = getSeverityConfig(anomaly.severity);
                  return (
                    <div
                      key={anomaly.id}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        !anomaly.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => markAsRead(anomaly.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">{config.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${config.textColor}`}>
                              {anomaly.severity?.toUpperCase()} Anomaly
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(anomaly.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {anomaly.message || 'Anomaly detected'}
                          </p>
                          {anomaly.value && (
                            <div className="text-xs text-gray-500 mt-1">
                              Value: {anomaly.value} 
                              {anomaly.threshold && ` (threshold: ${anomaly.threshold})`}
                            </div>
                          )}
                          {!anomaly.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {anomalies.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {criticalAnomalies.length} critical, {unreadAnomalies.length} unread
                </div>
                <button
                  onClick={clearAnomalies}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => {
          const config = getSeverityConfig(toast.anomaly.severity);
          return (
            <div
              key={toast.id}
              className={`
                transform transition-all duration-300 max-w-sm
                ${toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
              `}
            >
              <div className={`
                rounded-lg border shadow-lg p-4 ${config.bgColor} ${config.borderColor}
              `}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${config.textColor}`}>
                        {toast.anomaly.severity?.toUpperCase()} Anomaly Detected
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {toast.anomaly.message || 'New anomaly detected'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(toast.anomaly.timestamp)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnomalyNotificationCenter;