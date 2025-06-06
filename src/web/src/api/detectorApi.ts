import { Detector, DetectorsResponse, CreateDetectorRequest, UpdateDetectorRequest } from '../types/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

class DetectorApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'DetectorApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new DetectorApiError(response.status, errorData.error || 'API Error');
  }
  return response.json();
}

export class DetectorApi {
  // Fetch paginated list of detectors
  static async fetchDetectors(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  } = {}): Promise<DetectorsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.type) searchParams.append('type', params.type);
    if (params.status) searchParams.append('status', params.status);

    const response = await fetch(`${API_BASE_URL}/detectors?${searchParams}`);
    const data = await handleResponse<{
      detectors: Detector[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    }>(response);

    return {
      detectors: data.detectors,
      total: data.pagination.total,
      page: data.pagination.page,
      totalPages: data.pagination.total_pages
    };
  }

  // Fetch single detector by ID
  static async fetchDetectorById(id: string, includeHealth = false): Promise<Detector> {
    const searchParams = new URLSearchParams();
    if (includeHealth) searchParams.append('include_health', 'true');

    const response = await fetch(`${API_BASE_URL}/detectors/${id}?${searchParams}`);
    return handleResponse<Detector>(response);
  }

  // Create new detector
  static async createDetector(detectorData: CreateDetectorRequest): Promise<Detector> {
    const response = await fetch(`${API_BASE_URL}/detectors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(detectorData),
    });
    return handleResponse<Detector>(response);
  }

  // Update existing detector
  static async updateDetector(id: string, updateData: UpdateDetectorRequest): Promise<Detector> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    return handleResponse<Detector>(response);
  }

  // Delete detector
  static async deleteDetector(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}`, {
      method: 'DELETE',
    });
    await handleResponse<{ message: string }>(response);
  }

  // Start detector
  static async startDetector(id: string): Promise<{ message: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/start`, {
      method: 'POST',
    });
    return handleResponse<{ message: string; status: string }>(response);
  }

  // Stop detector
  static async stopDetector(id: string): Promise<{ message: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/stop`, {
      method: 'POST',
    });
    return handleResponse<{ message: string; status: string }>(response);
  }

  // Get detector status
  static async getDetectorStatus(id: string): Promise<{
    id: string;
    name: string;
    type: string;
    status: string;
    updated_at: string;
    metrics: {
      total_detections: number;
      anomalies_found: number;
      anomaly_rate: number;
      last_detection?: string;
      avg_response_time_ms: number;
    };
    statistics?: Record<string, any>;
  }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/status`);
    return handleResponse(response);
  }

  // Get detector health
  static async getDetectorHealth(id: string): Promise<{
    id: string;
    name: string;
    status: string;
    health: Record<string, any>;
  }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/health`);
    return handleResponse(response);
  }

  // Run single detection
  static async runDetection(id: string, data: {
    value?: number;
    values?: number[];
  }): Promise<{
    detector_id: string;
    is_anomaly: boolean;
    anomaly_score?: number;
    anomaly?: any;
    value?: number;
    values?: number[];
    detection_time: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  }

  // Train detector
  static async trainDetector(id: string, values: number[]): Promise<{
    message: string;
    training_time: number;
    sample_count: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/detectors/${id}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
    return handleResponse(response);
  }
}

export default DetectorApi; 