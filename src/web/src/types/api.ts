/**
 * Типы данных для работы с API
 */

// Аномалия
export interface Anomaly {
  id: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  threshold: number;
  source: string;
  description?: string;
  metadata?: Record<string, string>;
  status: 'active' | 'resolved' | 'acknowledged';
}

// Детектор аномалий - Updated to match backend API
export interface Detector {
  id: string;
  name: string;
  type: 'statistical' | 'window' | 'isolation_forest';
  status: 'stopped' | 'running' | 'error';
  config: DetectorConfig;
  created_at: string;
  updated_at: string;
  metrics: DetectorMetrics;
  // Legacy fields for backward compatibility
  enabled?: boolean;
  dataType?: string;
  threshold?: number;
  description?: string;
  parameters?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

// Конфигурация детектора - Matches backend DetectorConfig
export interface DetectorConfig {
  type: 'statistical' | 'window' | 'isolation_forest';
  dataType: string;
  threshold: number;
  parameters?: Record<string, any>;
  // Legacy fields
  minSamples?: number;
  windowSize?: number;
  numTrees?: number;
  sampleSize?: number;
}

// Метрики детектора - Matches backend DetectorMetrics
export interface DetectorMetrics {
  total_detections: number;
  anomalies_found: number;
  anomaly_rate: number;
  last_detection?: string;
  avg_response_time_ms: number;
}

// Запрос на создание детектора - Matches backend DetectorRequest
export interface CreateDetectorRequest {
  name: string;
  type: 'statistical' | 'window' | 'isolation_forest';
  config: DetectorConfig;
  description?: string;
}

// Запрос на обновление детектора
export interface UpdateDetectorRequest {
  name?: string;
  type?: 'statistical' | 'window' | 'isolation_forest';
  config?: DetectorConfig;
  description?: string;
}

// Ответ от детектора при детекции
export interface DetectionResult {
  detector_id: string;
  is_anomaly: boolean;
  anomaly_score?: number;
  anomaly?: Anomaly;
  value?: number;
  values?: number[];
  detection_time: number;
}

// Статус детектора
export interface DetectorStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  updated_at: string;
  metrics: DetectorMetrics;
  statistics?: Record<string, any>;
}

// Здоровье детектора
export interface DetectorHealth {
  id: string;
  name: string;
  status: string;
  health: {
    status: string;
    message?: string;
    last_computation?: string;
    sample_count?: number;
    detection_count?: number;
    anomaly_count?: number;
  };
}

// Результат тренировки детектора
export interface TrainingResult {
  message: string;
  training_time: number;
  sample_count: number;
}

// Действие восстановления
export interface Action {
  id: string;
  type: 'restart' | 'scale' | 'notify' | 'exec_script';
  target: string;
  parameters: Record<string, string>;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: ActionResult;
}

// Результат выполнения действия
export interface ActionResult {
  success: boolean;
  message?: string;
  details?: string;
  completedAt: string;
}

// Метрика
export interface Metric {
  name: string;
  labels: Record<string, string>;
  timestamp: string;
  value: number;
}

// План действий
export interface ActionPlan {
  id: string;
  name: string;
  description?: string;
  actions: Action[];
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// Параметры запроса для получения аномалий
export interface AnomalyQueryParams {
  startTime?: string;
  endTime?: string;
  severity?: string;
  source?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// Параметры запроса для получения действий
export interface ActionQueryParams {
  startTime?: string;
  endTime?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// Параметры запроса для получения детекторов - Updated
export interface DetectorQueryParams {
  page?: number;
  limit?: number;
  type?: 'statistical' | 'window' | 'isolation_forest';
  status?: 'stopped' | 'running' | 'error';
}

// Статистика системы
export interface SystemStats {
  totalAnomalies: number;
  activeAnomalies: number;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  uptime: number;
  lastUpdateTime: string;
}

// Ответ API со списком аномалий
export interface AnomaliesResponse {
  anomalies: Anomaly[];
  total: number;
  page: number;
  pageSize: number;
}

// Ответ API со списком детекторов - Updated to match backend
export interface DetectorsResponse {
  detectors: Detector[];
  total: number;
  page?: number;
  totalPages?: number;
}

// Ответ API со списком действий
export interface ActionsResponse {
  actions: Action[];
  total: number;
  page: number;
  pageSize: number;
}

// Пагинация для API ответов
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// Общий ответ API с пагинацией
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// Ошибка API
export interface ApiError {
  error: string;
  status: number;
  details?: string;
} 