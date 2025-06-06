import React from 'react';
import { useRealTimeDetector } from '../../hooks/useWebSocket';

interface DetectorStatusBadgeProps {
  detectorId: string;
  currentStatus?: string;
  className?: string;
  showLastUpdate?: boolean;
  animate?: boolean;
}

const DetectorStatusBadge: React.FC<DetectorStatusBadgeProps> = ({
  detectorId,
  currentStatus,
  className = '',
  showLastUpdate = false,
  animate = true
}) => {
  const { 
    detectorStatus, 
    detectorMetrics, 
    lastUpdate, 
    isConnected 
  } = useRealTimeDetector(detectorId);

  // Use real-time status if available, fall back to props
  const status = isConnected && detectorStatus !== 'unknown' ? detectorStatus : currentStatus || 'unknown';

  const getStatusConfig = () => {
    switch (status) {
      case 'running':
        return {
          label: 'Running',
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: '▶️',
          pulse: animate
        };
      case 'stopped':
        return {
          label: 'Stopped',
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: '⏸️',
          pulse: false
        };
      case 'starting':
        return {
          label: 'Starting',
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: '🔄',
          pulse: true
        };
      case 'stopping':
        return {
          label: 'Stopping',
          color: 'bg-orange-500',
          textColor: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: '⏹️',
          pulse: true
        };
      case 'error':
        return {
          label: 'Error',
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: '❌',
          pulse: animate
        };
      case 'training':
        return {
          label: 'Training',
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: '🧠',
          pulse: true
        };
      case 'detecting':
        return {
          label: 'Detecting',
          color: 'bg-purple-500',
          textColor: 'text-purple-700',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          icon: '🔍',
          pulse: true
        };
      default:
        return {
          label: 'Unknown',
          color: 'bg-gray-400',
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: '❓',
          pulse: false
        };
    }
  };

  const config = getStatusConfig();
  
  const formatLastUpdate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      {/* Status Badge */}
      <div 
        className={`
          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
          ${config.textColor} ${config.bgColor} ${config.borderColor}
          ${config.pulse ? 'animate-pulse' : ''}
        `}
      >
        <span className="mr-1">{config.icon}</span>
        {config.label}
        
        {/* Real-time indicator */}
        {isConnected && detectorStatus !== 'unknown' && (
          <div className={`ml-1 w-1.5 h-1.5 rounded-full ${config.color} animate-pulse`} />
        )}
      </div>

      {/* Metrics Preview */}
      {detectorMetrics && Object.keys(detectorMetrics).length > 0 && (
        <div className="hidden md:flex items-center space-x-2 text-xs text-gray-500">
          {detectorMetrics.detections_count && (
            <span title="Total detections">
              🔢 {detectorMetrics.detections_count}
            </span>
          )}
          
          {detectorMetrics.anomalies_count && (
            <span title="Anomalies found">
              ⚠️ {detectorMetrics.anomalies_count}
            </span>
          )}
          
          {detectorMetrics.accuracy && (
            <span title="Detection accuracy">
              🎯 {(detectorMetrics.accuracy * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Last Update */}
      {showLastUpdate && lastUpdate > 0 && (
        <div className="text-xs text-gray-400">
          Updated {formatLastUpdate(lastUpdate)}
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div className="text-xs text-gray-400" title="Real-time updates unavailable">
          📡❌
        </div>
      )}
    </div>
  );
};

export default DetectorStatusBadge; 