import React from 'react';
import { useAppSelector } from '../../store';
import { useWebSocketHealth } from '../../hooks/useWebSocket';

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const { 
    isHealthy, 
    status, 
    latency, 
    reconnectAttempts, 
    lastConnected, 
    uptime,
    subscriptions 
  } = useWebSocketHealth();

  const websocketState = useAppSelector(state => state.websocket);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-gray-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '⚫';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Indicator */}
      <div className="flex items-center space-x-1">
        <span className="text-sm">{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Details */}
      {showDetails && status === 'connected' && (
        <div className="hidden md:flex items-center space-x-4 text-xs text-gray-500">
          {latency > 0 && (
            <span title="Connection latency">
              📡 {formatLatency(latency)}
            </span>
          )}
          
          {uptime > 0 && (
            <span title="Connection uptime">
              ⏱️ {formatUptime(uptime)}
            </span>
          )}
          
          {subscriptions.length > 0 && (
            <span title={`Active subscriptions: ${subscriptions.join(', ')}`}>
              📺 {subscriptions.length}
            </span>
          )}
        </div>
      )}

      {/* Error State */}
      {showDetails && status === 'error' && websocketState.error && (
        <div className="text-xs text-red-500 max-w-xs truncate" title={websocketState.error}>
          Error: {websocketState.error}
        </div>
      )}

      {/* Reconnection Status */}
      {showDetails && status === 'connecting' && reconnectAttempts > 0 && (
        <div className="text-xs text-yellow-500">
          Reconnecting... (attempt {reconnectAttempts})
        </div>
      )}

      {/* Disconnected State */}
      {showDetails && status === 'disconnected' && reconnectAttempts > 0 && (
        <div className="text-xs text-gray-500">
          Connection lost. Last connected: {lastConnected ? new Date(lastConnected).toLocaleTimeString() : 'Never'}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;