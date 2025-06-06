package detector

import (
	"context"
	"testing"
)

func TestNewStatisticalDetector(t *testing.T) {
	tests := []struct {
		name      string
		mean      float64
		stdDev    float64
		threshold float64
		dataType  string
	}{
		{
			name:      "valid parameters",
			mean:      100,
			stdDev:    10,
			threshold: 2,
			dataType:  "cpu",
		},
		{
			name:      "zero values",
			mean:      0,
			stdDev:    0,
			threshold: 0,
			dataType:  "memory",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detector := NewStatisticalDetector(tt.mean, tt.stdDev, tt.threshold, tt.dataType)
			if detector == nil {
				t.Error("expected non-nil detector")
			}
			if detector.mean != tt.mean {
				t.Errorf("mean = %v, want %v", detector.mean, tt.mean)
			}
			if detector.stdDev != tt.stdDev {
				t.Errorf("stdDev = %v, want %v", detector.stdDev, tt.stdDev)
			}
			if detector.threshold != tt.threshold {
				t.Errorf("threshold = %v, want %v", detector.threshold, tt.threshold)
			}
			if detector.dataType != tt.dataType {
				t.Errorf("dataType = %v, want %v", detector.dataType, tt.dataType)
			}
		})
	}
}

func TestDetect(t *testing.T) {
	tests := []struct {
		name           string
		mean           float64
		stdDev         float64
		threshold      float64
		value          float64
		expectAnomaly  bool
		expectSeverity string
	}{
		{
			name:          "no anomaly",
			mean:          100,
			stdDev:        10,
			threshold:     2,
			value:         105,
			expectAnomaly: false,
		},
		{
			name:           "warning anomaly",
			mean:           100,
			stdDev:         10,
			threshold:      2,
			value:          125,
			expectAnomaly:  true,
			expectSeverity: "warning",
		},
		{
			name:           "critical anomaly",
			mean:           100,
			stdDev:         10,
			threshold:      2,
			value:          150,
			expectAnomaly:  true,
			expectSeverity: "critical",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detector := NewStatisticalDetector(tt.mean, tt.stdDev, tt.threshold, "test")
			ctx := context.Background()

			anomaly, err := detector.Detect(ctx, tt.value)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if tt.expectAnomaly {
				if anomaly == nil {
					t.Error("expected anomaly, got nil")
				} else if anomaly.Severity != tt.expectSeverity {
					t.Errorf("severity = %v, want %v", anomaly.Severity, tt.expectSeverity)
				}
			} else if anomaly != nil {
				t.Error("expected no anomaly, got one")
			}
		})
	}
}

func TestDetectContextCancellation(t *testing.T) {
	detector := NewStatisticalDetector(100, 10, 2, "test")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	anomaly, err := detector.Detect(ctx, 105)
	if err == nil {
		t.Error("expected error, got nil")
	}
	if anomaly != nil {
		t.Error("expected nil anomaly, got one")
	}
}

func TestUpdateParameters(t *testing.T) {
	tests := []struct {
		name      string
		mean      float64
		stdDev    float64
		expectErr bool
	}{
		{
			name:      "valid parameters",
			mean:      100,
			stdDev:    10,
			expectErr: false,
		},
		{
			name:      "negative stdDev",
			mean:      100,
			stdDev:    -10,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detector := NewStatisticalDetector(0, 1, 2, "test")
			err := detector.UpdateParameters(tt.mean, tt.stdDev)

			if tt.expectErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if detector.mean != tt.mean {
					t.Errorf("mean = %v, want %v", detector.mean, tt.mean)
				}
				if detector.stdDev != tt.stdDev {
					t.Errorf("stdDev = %v, want %v", detector.stdDev, tt.stdDev)
				}
			}
		})
	}
}

func TestNewDetector(t *testing.T) {
	tests := []struct {
		name        string
		config      DetectorConfig
		expectError bool
	}{
		{
			name: "valid statistical detector",
			config: DetectorConfig{
				Type:      TypeStatistical,
				DataType:  "test",
				Threshold: 2.0,
			},
			expectError: false,
		},
		{
			name: "valid window detector",
			config: DetectorConfig{
				Type:       TypeWindow,
				DataType:   "test",
				Threshold:  2.0,
				WindowSize: 10,
			},
			expectError: false,
		},
		{
			name: "valid isolation forest detector",
			config: DetectorConfig{
				Type:       TypeIsolationForest,
				DataType:   "test",
				Threshold:  0.6,
				NumTrees:   100,
				SampleSize: 256,
			},
			expectError: false,
		},
		{
			name: "invalid window size",
			config: DetectorConfig{
				Type:       TypeWindow,
				DataType:   "test",
				Threshold:  2.0,
				WindowSize: 0,
			},
			expectError: true,
		},
		{
			name: "invalid number of trees",
			config: DetectorConfig{
				Type:       TypeIsolationForest,
				DataType:   "test",
				Threshold:  0.6,
				NumTrees:   0,
				SampleSize: 256,
			},
			expectError: true,
		},
		{
			name: "invalid sample size",
			config: DetectorConfig{
				Type:       TypeIsolationForest,
				DataType:   "test",
				Threshold:  0.6,
				NumTrees:   100,
				SampleSize: 0,
			},
			expectError: true,
		},
		{
			name: "unknown detector type",
			config: DetectorConfig{
				Type:      DetectorType("unknown"),
				DataType:  "test",
				Threshold: 2.0,
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detector, err := NewDetector(tt.config)

			if tt.expectError {
				if err == nil {
					t.Error("expected error, got nil")
				}
				if detector != nil {
					t.Error("expected nil detector, got non-nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if detector == nil {
					t.Error("expected non-nil detector, got nil")
				}
			}
		})
	}
}

func TestDetectorType_String(t *testing.T) {
	tests := []struct {
		detectorType DetectorType
		want         string
	}{
		{TypeStatistical, "statistical"},
		{TypeWindow, "window"},
		{TypeIsolationForest, "isolation_forest"},
		{DetectorType("unknown"), "unknown"},
	}

	for _, tt := range tests {
		t.Run(string(tt.detectorType), func(t *testing.T) {
			if got := tt.detectorType.String(); got != tt.want {
				t.Errorf("DetectorType.String() = %v, want %v", got, tt.want)
			}
		})
	}
}
