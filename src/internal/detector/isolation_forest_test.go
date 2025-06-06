package detector

import (
	"context"
	"testing"
)

func TestIsolationForestDetector_NewIsolationForestDetector(t *testing.T) {
	tests := []struct {
		name       string
		numTrees   int
		sampleSize int
		threshold  float64
		dataType   string
	}{
		{
			name:       "valid parameters",
			numTrees:   100,
			sampleSize: 256,
			threshold:  0.6,
			dataType:   "test",
		},
		{
			name:       "small forest",
			numTrees:   10,
			sampleSize: 64,
			threshold:  0.5,
			dataType:   "minimal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewIsolationForestDetector(tt.numTrees, tt.sampleSize, tt.threshold, tt.dataType)
			if d == nil {
				t.Fatal("expected non-nil detector")
			}

			if d.numTrees != tt.numTrees {
				t.Errorf("numTrees = %v, want %v", d.numTrees, tt.numTrees)
			}
			if d.sampleSize != tt.sampleSize {
				t.Errorf("sampleSize = %v, want %v", d.sampleSize, tt.sampleSize)
			}
			if d.threshold != tt.threshold {
				t.Errorf("threshold = %v, want %v", d.threshold, tt.threshold)
			}
			if d.dataType != tt.dataType {
				t.Errorf("dataType = %v, want %v", d.dataType, tt.dataType)
			}
			if len(d.trees) != tt.numTrees {
				t.Errorf("trees length = %v, want %v", len(d.trees), tt.numTrees)
			}
		})
	}
}

func TestIsolationForestDetector_Training(t *testing.T) {
	d := NewIsolationForestDetector(10, 5, 0.6, "test")
	ctx := context.Background()

	// Check initial state
	if d.IsInitialized() {
		t.Error("expected uninitialized detector")
	}

	current, required := d.GetTrainingProgress()
	if current != 0 || required != 5 {
		t.Errorf("initial progress: current = %v, required = %v, want 0, 5", current, required)
	}

	// Feed training data
	normalValues := []float64{10, 11, 9, 10.5, 10.2}
	for i, v := range normalValues {
		_, err := d.Detect(ctx, v)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		current, required = d.GetTrainingProgress()
		if current != i+1 || required != 5 {
			t.Errorf("training progress: current = %v, required = %v, want %v, 5", current, required, i+1)
		}
	}

	// Check if initialized after training
	if !d.IsInitialized() {
		t.Error("expected initialized detector after training")
	}
}

func TestIsolationForestDetector_Detect(t *testing.T) {
	d := NewIsolationForestDetector(100, 10, 0.6, "test")
	ctx := context.Background()

	// Train with normal data
	normalValues := []float64{10, 11, 9, 10.5, 10.2, 10.8, 9.8, 10.3, 10.6, 9.9}
	for _, v := range normalValues {
		_, err := d.Detect(ctx, v)
		if err != nil {
			t.Fatalf("unexpected error during training: %v", err)
		}
	}

	// Test detection
	tests := []struct {
		name          string
		value         float64
		expectAnomaly bool
	}{
		{
			name:          "normal value",
			value:         10.4,
			expectAnomaly: false,
		},
		{
			name:          "slight anomaly",
			value:         15.0,
			expectAnomaly: true,
		},
		{
			name:          "extreme anomaly",
			value:         100.0,
			expectAnomaly: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			anomaly, err := d.Detect(ctx, tt.value)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.expectAnomaly && anomaly == nil {
				t.Error("expected anomaly, got nil")
			} else if !tt.expectAnomaly && anomaly != nil {
				t.Error("expected no anomaly, got one")
			}
		})
	}
}

func TestIsolationForestDetector_UpdateThreshold(t *testing.T) {
	d := NewIsolationForestDetector(10, 5, 0.6, "test")

	tests := []struct {
		name        string
		threshold   float64
		expectError bool
	}{
		{
			name:        "valid threshold",
			threshold:   0.7,
			expectError: false,
		},
		{
			name:        "zero threshold",
			threshold:   0.0,
			expectError: true,
		},
		{
			name:        "negative threshold",
			threshold:   -0.1,
			expectError: true,
		},
		{
			name:        "threshold too high",
			threshold:   1.1,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
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

func TestIsolationForestDetector_ContextCancellation(t *testing.T) {
	d := NewIsolationForestDetector(10, 5, 0.6, "test")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := d.Detect(ctx, 10.0)
	if err == nil {
		t.Error("expected error due to cancelled context, got nil")
	}
}
