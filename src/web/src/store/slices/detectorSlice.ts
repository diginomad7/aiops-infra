import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Detector, 
  DetectorsResponse, 
  CreateDetectorRequest, 
  UpdateDetectorRequest,
  DetectorStatus,
  DetectorHealth,
  DetectionResult,
  TrainingResult,
  DetectorQueryParams
} from '../../types/api';
import DetectorApi from '../../api/detectorApi';

// Async thunks для API вызовов - Updated to use real API
export const fetchDetectors = createAsyncThunk(
  'detectors/fetchDetectors',
  async (params: DetectorQueryParams = {}) => {
    try {
      return await DetectorApi.fetchDetectors(params);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch detectors');
    }
  }
);

export const createDetector = createAsyncThunk(
  'detectors/createDetector',
  async (detectorData: CreateDetectorRequest) => {
    try {
      return await DetectorApi.createDetector(detectorData);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create detector');
    }
  }
);

export const updateDetector = createAsyncThunk(
  'detectors/updateDetector',
  async ({ id, data }: { id: string; data: UpdateDetectorRequest }) => {
    try {
      const updatedDetector = await DetectorApi.updateDetector(id, data);
      return { id, detector: updatedDetector };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update detector');
    }
  }
);

export const deleteDetector = createAsyncThunk(
  'detectors/deleteDetector',
  async (id: string) => {
    try {
      await DetectorApi.deleteDetector(id);
      return id;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete detector');
    }
  }
);

export const fetchDetectorById = createAsyncThunk(
  'detectors/fetchDetectorById',
  async ({ id, includeHealth = false }: { id: string; includeHealth?: boolean }) => {
    try {
      return await DetectorApi.fetchDetectorById(id, includeHealth);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch detector');
    }
  }
);

// New: Start/Stop detector operations
export const startDetector = createAsyncThunk(
  'detectors/startDetector',
  async (id: string) => {
    try {
      const result = await DetectorApi.startDetector(id);
      return { id, status: result.status, message: result.message };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to start detector');
    }
  }
);

export const stopDetector = createAsyncThunk(
  'detectors/stopDetector',
  async (id: string) => {
    try {
      const result = await DetectorApi.stopDetector(id);
      return { id, status: result.status, message: result.message };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to stop detector');
    }
  }
);

// New: Get detector status
export const fetchDetectorStatus = createAsyncThunk(
  'detectors/fetchDetectorStatus',
  async (id: string) => {
    try {
      return await DetectorApi.getDetectorStatus(id);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch detector status');
    }
  }
);

// New: Get detector health
export const fetchDetectorHealth = createAsyncThunk(
  'detectors/fetchDetectorHealth',
  async (id: string) => {
    try {
      return await DetectorApi.getDetectorHealth(id);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch detector health');
    }
  }
);

// New: Run detection
export const runDetection = createAsyncThunk(
  'detectors/runDetection',
  async ({ id, data }: { id: string; data: { value?: number; values?: number[] } }) => {
    try {
      return await DetectorApi.runDetection(id, data);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to run detection');
    }
  }
);

// New: Train detector
export const trainDetector = createAsyncThunk(
  'detectors/trainDetector',
  async ({ id, values }: { id: string; values: number[] }) => {
    try {
      const result = await DetectorApi.trainDetector(id, values);
      return { id, result };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to train detector');
    }
  }
);

// Enhanced state interface
interface DetectorState {
  detectors: Detector[];
  currentDetector: Detector | null;
  currentStatus: DetectorStatus | null;
  currentHealth: DetectorHealth | null;
  lastDetection: DetectionResult | null;
  lastTraining: TrainingResult | null;
  loading: boolean;
  statusLoading: boolean;
  healthLoading: boolean;
  detectionLoading: boolean;
  trainingLoading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
}

// Initial state
const initialState: DetectorState = {
  detectors: [],
  currentDetector: null,
  currentStatus: null,
  currentHealth: null,
  lastDetection: null,
  lastTraining: null,
  loading: false,
  statusLoading: false,
  healthLoading: false,
  detectionLoading: false,
  trainingLoading: false,
  error: null,
  total: 0,
  page: 1,
  totalPages: 1,
};

// Slice
const detectorSlice = createSlice({
  name: 'detectors',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentDetector: (state) => {
      state.currentDetector = null;
      state.currentStatus = null;
      state.currentHealth = null;
    },
    clearLastDetection: (state) => {
      state.lastDetection = null;
    },
    clearLastTraining: (state) => {
      state.lastTraining = null;
    },
    // Real-time WebSocket actions
    addDetector: (state, action: PayloadAction<Detector>) => {
      // Add new detector from WebSocket event
      const existingIndex = state.detectors.findIndex(d => d.id === action.payload.id);
      if (existingIndex === -1) {
        state.detectors.unshift(action.payload);
        state.total += 1;
      } else {
        // Update existing detector
        state.detectors[existingIndex] = action.payload;
      }
    },
    removeDetector: (state, action: PayloadAction<string>) => {
      // Remove detector from WebSocket event
      const index = state.detectors.findIndex(d => d.id === action.payload);
      if (index !== -1) {
        state.detectors.splice(index, 1);
        state.total -= 1;
      }
      if (state.currentDetector && state.currentDetector.id === action.payload) {
        state.currentDetector = null;
        state.currentStatus = null;
        state.currentHealth = null;
      }
    },
    updateDetectorStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      // Update detector status from WebSocket event
      const { id, status } = action.payload;
      const detector = state.detectors.find(d => d.id === id);
      if (detector) {
        detector.status = status as any;
        detector.updated_at = new Date().toISOString();
      }
      if (state.currentDetector && state.currentDetector.id === id) {
        state.currentDetector.status = status as any;
        state.currentDetector.updated_at = new Date().toISOString();
      }
      // Update current status if it matches
      if (state.currentStatus && state.currentStatus.id === id) {
        state.currentStatus = {
          ...state.currentStatus,
          status: status as any,
          updated_at: new Date().toISOString()
        };
      }
    },
    updateDetectorMetrics: (state, action: PayloadAction<{ id: string; metrics: any }>) => {
      // Update detector metrics from WebSocket event
      const { id, metrics } = action.payload;
      const detector = state.detectors.find(d => d.id === id);
      if (detector) {
        detector.metrics = metrics;
        detector.updated_at = new Date().toISOString();
      }
      if (state.currentDetector && state.currentDetector.id === id) {
        state.currentDetector.metrics = metrics;
        state.currentDetector.updated_at = new Date().toISOString();
      }
      // Update current health if it matches
      if (state.currentHealth && state.currentHealth.id === id) {
        state.currentHealth = {
          ...state.currentHealth,
          metrics: metrics,
          updated_at: new Date().toISOString()
        };
      }
    },
    addAnomaly: (state, action: PayloadAction<any>) => {
      // Add anomaly from WebSocket event
      const anomaly = action.payload;
      // Update last detection if the anomaly is from current detector
      if (state.currentDetector && anomaly.detectorId === state.currentDetector.id) {
        state.lastDetection = {
          id: anomaly.id,
          detector_id: anomaly.detectorId,
          value: anomaly.value,
          threshold: anomaly.threshold,
          anomaly_score: anomaly.score || 0,
          is_anomaly: true,
          severity: anomaly.severity,
          message: anomaly.message,
          timestamp: anomaly.timestamp,
          created_at: new Date().toISOString()
        };
      }
    },
    // Legacy action for backward compatibility
    toggleDetector: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
      const detector = state.detectors.find(d => d.id === action.payload.id);
      if (detector) {
        // Convert legacy enabled field to status
        detector.status = action.payload.enabled ? 'running' : 'stopped';
        detector.updated_at = new Date().toISOString();
        // Update legacy field for backward compatibility
        if (detector.enabled !== undefined) {
          detector.enabled = action.payload.enabled;
        }
        if (detector.updatedAt !== undefined) {
          detector.updatedAt = new Date().toISOString();
        }
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch detectors
    builder
      .addCase(fetchDetectors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDetectors.fulfilled, (state, action) => {
        state.loading = false;
        state.detectors = action.payload.detectors;
        state.total = action.payload.total;
        state.page = action.payload.page || 1;
        state.totalPages = action.payload.totalPages || 1;
      })
      .addCase(fetchDetectors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch detectors';
      });

    // Create detector
    builder
      .addCase(createDetector.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDetector.fulfilled, (state, action) => {
        state.loading = false;
        state.detectors.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createDetector.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create detector';
      });

    // Update detector
    builder
      .addCase(updateDetector.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDetector.fulfilled, (state, action) => {
        state.loading = false;
        const { id, detector } = action.payload;
        const index = state.detectors.findIndex(d => d.id === id);
        if (index !== -1) {
          state.detectors[index] = detector;
        }
        if (state.currentDetector && state.currentDetector.id === id) {
          state.currentDetector = detector;
        }
      })
      .addCase(updateDetector.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update detector';
      });

    // Delete detector
    builder
      .addCase(deleteDetector.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDetector.fulfilled, (state, action) => {
        state.loading = false;
        state.detectors = state.detectors.filter(d => d.id !== action.payload);
        state.total -= 1;
        if (state.currentDetector && state.currentDetector.id === action.payload) {
          state.currentDetector = null;
          state.currentStatus = null;
          state.currentHealth = null;
        }
      })
      .addCase(deleteDetector.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete detector';
      });

    // Fetch detector by ID
    builder
      .addCase(fetchDetectorById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDetectorById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDetector = action.payload;
      })
      .addCase(fetchDetectorById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch detector';
      });

    // Start detector
    builder
      .addCase(startDetector.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startDetector.fulfilled, (state, action) => {
        state.loading = false;
        const { id, status } = action.payload;
        const detector = state.detectors.find(d => d.id === id);
        if (detector) {
          detector.status = status as any;
          detector.updated_at = new Date().toISOString();
        }
        if (state.currentDetector && state.currentDetector.id === id) {
          state.currentDetector.status = status as any;
          state.currentDetector.updated_at = new Date().toISOString();
        }
      })
      .addCase(startDetector.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to start detector';
      });

    // Stop detector
    builder
      .addCase(stopDetector.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(stopDetector.fulfilled, (state, action) => {
        state.loading = false;
        const { id, status } = action.payload;
        const detector = state.detectors.find(d => d.id === id);
        if (detector) {
          detector.status = status as any;
          detector.updated_at = new Date().toISOString();
        }
        if (state.currentDetector && state.currentDetector.id === id) {
          state.currentDetector.status = status as any;
          state.currentDetector.updated_at = new Date().toISOString();
        }
      })
      .addCase(stopDetector.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to stop detector';
      });

    // Fetch detector status
    builder
      .addCase(fetchDetectorStatus.pending, (state) => {
        state.statusLoading = true;
        state.error = null;
      })
      .addCase(fetchDetectorStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.currentStatus = action.payload;
      })
      .addCase(fetchDetectorStatus.rejected, (state, action) => {
        state.statusLoading = false;
        state.error = action.error.message || 'Failed to fetch detector status';
      });

    // Fetch detector health
    builder
      .addCase(fetchDetectorHealth.pending, (state) => {
        state.healthLoading = true;
        state.error = null;
      })
      .addCase(fetchDetectorHealth.fulfilled, (state, action) => {
        state.healthLoading = false;
        state.currentHealth = action.payload;
      })
      .addCase(fetchDetectorHealth.rejected, (state, action) => {
        state.healthLoading = false;
        state.error = action.error.message || 'Failed to fetch detector health';
      });

    // Run detection
    builder
      .addCase(runDetection.pending, (state) => {
        state.detectionLoading = true;
        state.error = null;
      })
      .addCase(runDetection.fulfilled, (state, action) => {
        state.detectionLoading = false;
        state.lastDetection = action.payload;
      })
      .addCase(runDetection.rejected, (state, action) => {
        state.detectionLoading = false;
        state.error = action.error.message || 'Failed to run detection';
      });

    // Train detector
    builder
      .addCase(trainDetector.pending, (state) => {
        state.trainingLoading = true;
        state.error = null;
      })
      .addCase(trainDetector.fulfilled, (state, action) => {
        state.trainingLoading = false;
        state.lastTraining = action.payload.result;
        // Update detector's updated_at timestamp
        const detector = state.detectors.find(d => d.id === action.payload.id);
        if (detector) {
          detector.updated_at = new Date().toISOString();
        }
        if (state.currentDetector && state.currentDetector.id === action.payload.id) {
          state.currentDetector.updated_at = new Date().toISOString();
        }
      })
      .addCase(trainDetector.rejected, (state, action) => {
        state.trainingLoading = false;
        state.error = action.error.message || 'Failed to train detector';
      });
  }
});

// Export actions
export const { 
  clearError, 
  clearCurrentDetector, 
  clearLastDetection,
  clearLastTraining,
  addDetector,
  removeDetector,
  updateDetectorStatus,
  updateDetectorMetrics,
  addAnomaly,
  toggleDetector 
} = detectorSlice.actions;

// Export the slice for use in middleware
export { detectorSlice };

// Export reducer
export default detectorSlice.reducer;

// Enhanced selectors
export const selectDetectors = (state: { detectors: DetectorState }) => state.detectors.detectors;
export const selectCurrentDetector = (state: { detectors: DetectorState }) => state.detectors.currentDetector;
export const selectCurrentStatus = (state: { detectors: DetectorState }) => state.detectors.currentStatus;
export const selectCurrentHealth = (state: { detectors: DetectorState }) => state.detectors.currentHealth;
export const selectLastDetection = (state: { detectors: DetectorState }) => state.detectors.lastDetection;
export const selectLastTraining = (state: { detectors: DetectorState }) => state.detectors.lastTraining;
export const selectDetectorsLoading = (state: { detectors: DetectorState }) => state.detectors.loading;
export const selectStatusLoading = (state: { detectors: DetectorState }) => state.detectors.statusLoading;
export const selectHealthLoading = (state: { detectors: DetectorState }) => state.detectors.healthLoading;
export const selectDetectionLoading = (state: { detectors: DetectorState }) => state.detectors.detectionLoading;
export const selectTrainingLoading = (state: { detectors: DetectorState }) => state.detectors.trainingLoading;
export const selectDetectorsError = (state: { detectors: DetectorState }) => state.detectors.error;
export const selectDetectorsTotal = (state: { detectors: DetectorState }) => state.detectors.total;
export const selectDetectorsPage = (state: { detectors: DetectorState }) => state.detectors.page;
export const selectDetectorsTotalPages = (state: { detectors: DetectorState }) => state.detectors.totalPages; 