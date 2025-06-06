package detector

import (
	"context"
	"testing"
)

func TestWindowDetector_NewWindowDetector(t *testing.T) {
	tests := []struct {
		name       string
		windowSize int
		threshold  float64
		dataType   string
	}{
		{
			name:       "valid parameters",
			windowSize: 10,
			threshold:  2.0,
			dataType:   "test",
		},
		{
			name:       "small window",
			windowSize: 2,
			threshold:  1.5,
			dataType:   "minimal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewWindowDetector(tt.windowSize, tt.threshold, tt.dataType)
			if d == nil {
				t.Fatal("expected non-nil detector")
			}

			if d.windowSize != tt.windowSize {
				t.Errorf("windowSize = %v, want %v", d.windowSize, tt.windowSize)
			}
			if d.threshold != tt.threshold {
				t.Errorf("threshold = %v, want %v", d.threshold, tt.threshold)
			}
			if d.dataType != tt.dataType {
				t.Errorf("dataType = %v, want %v", d.dataType, tt.dataType)
			}
			if len(d.values) != tt.windowSize {
				t.Errorf("values length = %v, want %v", len(d.values), tt.windowSize)
			}
		})
	}
}

func TestWindowDetector_Detect(t *testing.T) {
	tests := []struct {
		name           string
		windowSize     int
		threshold      float64
		values         []float64
		expectAnomaly  bool
		expectSeverity string
	}{
		{
			name:          "no anomaly",
			windowSize:    5,
			threshold:     2.0,
			values:        []float64{10, 11, 9, 10.5, 10.2, 10.8},
			expectAnomaly: false,
		},
		{
			name:           "warning anomaly",
			windowSize:     5,
			threshold:      2.0,
			values:         []float64{10, 11, 9, 10.5, 10.2, 15},
			expectAnomaly:  true,
			expectSeverity: "warning",
		},
		{
			name:           "critical anomaly",
			windowSize:     5,
			threshold:      2.0,
			values:         []float64{10, 11, 9, 10.5, 10.2, 20},
			expectAnomaly:  true,
			expectSeverity: "critical",
		},
		{
			name:          "insufficient data",
			windowSize:    5,
			threshold:     2.0,
			values:        []float64{10},
			expectAnomaly: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewWindowDetector(tt.windowSize, tt.threshold, "test")
			ctx := context.Background()

			// Feed values into detector
			for i := 0; i < len(tt.values)-1; i++ {
				_, err := d.Detect(ctx, tt.values[i])
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}

			// Test final value
			anomaly, err := d.Detect(ctx, tt.values[len(tt.values)-1])
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
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

func TestWindowDetector_UpdateThreshold(t *testing.T) {
	tests := []struct {
		name        string
		threshold   float64
		expectError bool
	}{
		{
			name:        "valid threshold",
			threshold:   2.5,
			expectError: false,
		},
		{
			name:        "zero threshold",
			threshold:   0,
			expectError: true,
		},
		{
			name:        "negative threshold",
			threshold:   -1,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewWindowDetector(5, 2.0, "test")
			err := d.UpdateThreshold(tt.threshold)

			if tt.expectError {
				if err == nil {
					t.Error("expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if d.threshold != tt.threshold {
					t.Errorf("threshold = %v, want %v", d.threshold, tt.threshold)
				}
			}
		})
	}
}

func TestWindowDetector_GetWindowStats(t *testing.T) {
	d := NewWindowDetector(5, 2.0, "test")
	ctx := context.Background()

	// Test empty window
	size, filled := d.GetWindowStats()
	if size != 5 || filled != 0 {
		t.Errorf("empty window: size = %v, filled = %v, want size = 5, filled = 0", size, filled)
	}

	// Add some values
	values := []float64{1.0, 2.0, 3.0}
	for _, v := range values {
		_, err := d.Detect(ctx, v)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	// Test partially filled window
	size, filled = d.GetWindowStats()
	if size != 5 || filled != 3 {
		t.Errorf("partially filled window: size = %v, filled = %v, want size = 5, filled = 3", size, filled)
	}
}

func TestWindowDetector_ContextCancellation(t *testing.T) {
	d := NewWindowDetector(5, 2.0, "test")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := d.Detect(ctx, 10.0)
	if err == nil {
		t.Error("expected error due to cancelled context, got nil")
	}
}
