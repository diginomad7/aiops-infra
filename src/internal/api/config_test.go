package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yourusername/aiops-infra/src/internal/detector"
)

func TestConfigHandler_HandleUpdate(t *testing.T) {
	handler := NewConfigHandler()
	d := detector.NewStatisticalDetector(100, 10, 2, "test")
	handler.RegisterDetector("test-detector", d)

	tests := []struct {
		name           string
		method         string
		detectorName   string
		config         DetectorConfig
		expectedStatus int
		expectedError  bool
	}{
		{
			name:         "valid update",
			method:       http.MethodPost,
			detectorName: "test-detector",
			config: DetectorConfig{
				Mean:      150,
				StdDev:    15,
				Threshold: 2,
				DataType:  "test",
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name:           "invalid method",
			method:         http.MethodGet,
			detectorName:   "test-detector",
			expectedStatus: http.StatusMethodNotAllowed,
			expectedError:  true,
		},
		{
			name:           "missing detector name",
			method:         http.MethodPost,
			detectorName:   "",
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "invalid detector name",
			method:       http.MethodPost,
			detectorName: "non-existent",
			config: DetectorConfig{
				Mean:   150,
				StdDev: 15,
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  true,
		},
		{
			name:         "invalid parameters",
			method:       http.MethodPost,
			detectorName: "test-detector",
			config: DetectorConfig{
				Mean:   150,
				StdDev: -15, // Negative StdDev should fail
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			var err error
			if tt.method == http.MethodPost {
				body, err = json.Marshal(tt.config)
				if err != nil {
					t.Fatalf("Failed to marshal config: %v", err)
				}
			}

			req := httptest.NewRequest(tt.method, "/config?name="+tt.detectorName, bytes.NewBuffer(body))
			w := httptest.NewRecorder()

			handler.HandleUpdate(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectedError && w.Code != http.StatusOK {
				t.Errorf("Expected success, got error: %s", w.Body.String())
			}

			if tt.expectedError && w.Code == http.StatusOK {
				t.Error("Expected error, got success")
			}

			// Verify detector parameters were updated for successful cases
			if w.Code == http.StatusOK {
				d, ok := handler.GetDetector(tt.detectorName)
				if !ok {
					t.Fatal("Detector not found after update")
				}
				sd, ok := d.(*detector.StatisticalDetector)
				if !ok {
					t.Fatal("Invalid detector type")
				}
				// Add a method to get current parameters for testing
				mean, stdDev := sd.GetParameters()
				if mean != tt.config.Mean || stdDev != tt.config.StdDev {
					t.Errorf("Parameters not updated correctly. Got mean=%v, stdDev=%v, want mean=%v, stdDev=%v",
						mean, stdDev, tt.config.Mean, tt.config.StdDev)
				}
			}
		})
	}
}

func TestConfigHandler_ServeHTTP(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		config         DetectorConfig
		expectedStatus int
		expectError    bool
	}{
		{
			name:   "valid statistical detector",
			method: http.MethodPost,
			config: DetectorConfig{
				Type:      "statistical",
				DataType:  "cpu",
				Threshold: 2.0,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:   "valid window detector",
			method: http.MethodPost,
			config: DetectorConfig{
				Type:       "window",
				DataType:   "memory",
				Threshold:  2.0,
				WindowSize: 10,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:   "valid isolation forest detector",
			method: http.MethodPost,
			config: DetectorConfig{
				Type:       "isolation_forest",
				DataType:   "network",
				Threshold:  0.6,
				NumTrees:   100,
				SampleSize: 256,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:   "invalid detector type",
			method: http.MethodPost,
			config: DetectorConfig{
				Type:      "unknown",
				DataType:  "test",
				Threshold: 2.0,
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:   "invalid window size",
			method: http.MethodPost,
			config: DetectorConfig{
				Type:       "window",
				DataType:   "test",
				Threshold:  2.0,
				WindowSize: 0,
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:   "invalid method",
			method: http.MethodGet,
			config: DetectorConfig{
				Type:      "statistical",
				DataType:  "test",
				Threshold: 2.0,
			},
			expectedStatus: http.StatusMethodNotAllowed,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewConfigHandler()

			body, err := json.Marshal(tt.config)
			if err != nil {
				t.Fatalf("Failed to marshal config: %v", err)
			}

			req := httptest.NewRequest(tt.method, "/config", bytes.NewReader(body))
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			if !tt.expectError && tt.method == http.MethodPost {
				// Verify detector was created
				d := handler.GetDetector(tt.config.DataType)
				if d == nil {
					t.Error("expected detector to be created")
				}
			}
		})
	}
}

func TestConfigHandler_GetDetector(t *testing.T) {
	handler := NewConfigHandler()

	// Create a detector
	config := DetectorConfig{
		Type:      "statistical",
		DataType:  "test",
		Threshold: 2.0,
	}

	body, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Failed to marshal config: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/config", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Failed to create detector: %d", rec.Code)
	}

	// Test GetDetector
	d := handler.GetDetector(config.DataType)
	if d == nil {
		t.Error("expected detector to be found")
	}

	// Test non-existent detector
	d = handler.GetDetector("non-existent")
	if d != nil {
		t.Error("expected nil for non-existent detector")
	}
}
