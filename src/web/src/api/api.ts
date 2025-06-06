import axios from 'axios';
import { 
  Anomaly, 
  Detector, 
  Action, 
  AnomalyQueryParams, 
  ActionQueryParams,
  AnomaliesResponse,
  DetectorsResponse,
  ActionsResponse,
  SystemStats,
  ActionPlan
} from '../types/api';

// Базовый URL для API
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Создаем экземпляр Axios с базовыми настройками
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API для работы с аномалиями
export const anomalyAPI = {
  // Получение списка аномалий с возможностью фильтрации
  getAnomalies: async (params?: AnomalyQueryParams): Promise<AnomaliesResponse> => {
    const response = await api.get('/anomalies', { params });
    return response.data;
  },

  // Получение конкретной аномалии по ID
  getAnomalyById: async (id: string): Promise<Anomaly> => {
    const response = await api.get(`/anomalies/${id}`);
    return response.data;
  },

  // Подтверждение аномалии (установка статуса "acknowledged")
  acknowledgeAnomaly: async (id: string): Promise<Anomaly> => {
    const response = await api.post(`/anomalies/${id}/acknowledge`);
    return response.data;
  },

  // Разрешение аномалии (установка статуса "resolved")
  resolveAnomaly: async (id: string): Promise<Anomaly> => {
    const response = await api.post(`/anomalies/${id}/resolve`);
    return response.data;
  },
};

// API для работы с детекторами
export const detectorAPI = {
  // Получение списка детекторов
  getDetectors: async (): Promise<DetectorsResponse> => {
    const response = await api.get('/detectors');
    return response.data;
  },

  // Получение детектора по ID
  getDetectorById: async (id: string): Promise<Detector> => {
    const response = await api.get(`/detectors/${id}`);
    return response.data;
  },

  // Создание нового детектора
  createDetector: async (detector: Omit<Detector, 'id' | 'createdAt' | 'updatedAt'>): Promise<Detector> => {
    const response = await api.post('/detectors', detector);
    return response.data;
  },

  // Обновление существующего детектора
  updateDetector: async (id: string, detector: Partial<Detector>): Promise<Detector> => {
    const response = await api.put(`/detectors/${id}`, detector);
    return response.data;
  },

  // Удаление детектора
  deleteDetector: async (id: string): Promise<void> => {
    await api.delete(`/detectors/${id}`);
  },

  // Включение детектора
  enableDetector: async (id: string): Promise<Detector> => {
    const response = await api.post(`/detectors/${id}/enable`);
    return response.data;
  },

  // Отключение детектора
  disableDetector: async (id: string): Promise<Detector> => {
    const response = await api.post(`/detectors/${id}/disable`);
    return response.data;
  },
};

// API для работы с действиями
export const actionAPI = {
  // Получение списка действий с возможностью фильтрации
  getActions: async (params?: ActionQueryParams): Promise<ActionsResponse> => {
    const response = await api.get('/actions', { params });
    return response.data;
  },

  // Получение конкретного действия по ID
  getActionById: async (id: string): Promise<Action> => {
    const response = await api.get(`/actions/${id}`);
    return response.data;
  },

  // Выполнение действия
  executeAction: async (action: Omit<Action, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'completedAt' | 'result'>): Promise<Action> => {
    const response = await api.post('/actions', action);
    return response.data;
  },

  // Отмена выполнения действия
  cancelAction: async (id: string): Promise<Action> => {
    const response = await api.post(`/actions/${id}/cancel`);
    return response.data;
  },

  // Выполнение плана действий
  executeActionPlan: async (plan: Omit<ActionPlan, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<ActionPlan> => {
    const response = await api.post('/actionplan', plan);
    return response.data;
  },
};

// API для работы с системной информацией
export const systemAPI = {
  // Получение общей статистики системы
  getSystemStats: async (): Promise<SystemStats> => {
    const response = await api.get('/system/stats');
    return response.data;
  },

  // Проверка состояния системы (health check)
  checkHealth: async (): Promise<{ status: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default {
  anomaly: anomalyAPI,
  detector: detectorAPI,
  action: actionAPI,
  system: systemAPI,
}; 