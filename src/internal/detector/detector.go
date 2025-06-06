package detector

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/metrics"
)

// Anomaly represents a detected anomaly
type Anomaly struct {
	Timestamp time.Time
	Type      string
	Severity  string
	Value     float64
	Threshold float64
	Source    string
}

// Detector interface defines methods for anomaly detection
type Detector interface {
	// Detect checks if a value is anomalous
	Detect(ctx context.Context, value float64) (*Anomaly, error)
	// UpdateThreshold updates the detection threshold
	UpdateThreshold(threshold float64) error
	// IsAnomaly checks if values are anomalous and returns a score
	IsAnomaly(values []float64) (bool, float64, error)
	// Type returns the type of detector
	Type() string
}

// TrainableDetector interface defines methods for anomaly detectors that can be trained
type TrainableDetector interface {
	Detector
	// Train trains the detector using the provided values
	Train(values []float64) error
}

// ConfigurableDetector interface defines methods for configurable detectors
type ConfigurableDetector interface {
	Detector
	// Configure updates detector configuration
	Configure(config DetectorConfig) error
	// GetStatistics returns detector statistics
	GetStatistics() map[string]interface{}
}

// HealthCheckDetector interface defines health check capabilities
type HealthCheckDetector interface {
	// Health returns health status and metrics
	Health() map[string]interface{}
}

// DetectorType represents different types of anomaly detectors
type DetectorType string

// String returns the string representation of DetectorType
func (dt DetectorType) String() string {
	return string(dt)
}

const (
	// TypeStatistical uses statistical methods (mean, std dev)
	TypeStatistical DetectorType = "statistical"
	// TypeWindow uses sliding window statistics
	TypeWindow DetectorType = "window"
	// TypeIsolationForest uses isolation forest algorithm
	TypeIsolationForest DetectorType = "isolation_forest"
)

// DetectorConfig holds configuration for creating detectors
type DetectorConfig struct {
	Type       DetectorType           `json:"type" yaml:"type"`
	DataType   string                 `json:"dataType" yaml:"dataType"`
	Threshold  float64                `json:"threshold" yaml:"threshold"`
	Parameters map[string]interface{} `json:"parameters" yaml:"parameters"`

	// Legacy fields for backward compatibility
	MinSamples int `json:"minSamples,omitempty" yaml:"minSamples,omitempty"`
	WindowSize int `json:"windowSize,omitempty" yaml:"windowSize,omitempty"`
	NumTrees   int `json:"numTrees,omitempty" yaml:"numTrees,omitempty"`
	SampleSize int `json:"sampleSize,omitempty" yaml:"sampleSize,omitempty"`
}

// StatisticalDetector implements anomaly detection using statistical methods
type StatisticalDetector struct {
	mu sync.RWMutex

	mean      float64
	stdDev    float64
	threshold float64
	dataType  string

	// Enhanced features
	values          []float64
	windowSize      int
	minSamples      int
	autoUpdate      bool
	useMAD          bool
	median          float64
	mad             float64 // Median Absolute Deviation
	lastComputation time.Time
	detectionCount  int64
	anomalyCount    int64
}

// NewStatisticalDetector creates a new statistical anomaly detector
func NewStatisticalDetector(threshold, mean, stdDev float64, dataType string) *StatisticalDetector {
	return &StatisticalDetector{
		mean:       mean,
		stdDev:     stdDev,
		threshold:  threshold,
		dataType:   dataType,
		windowSize: 300,  // Default 5 minutes at 1 second intervals
		minSamples: 10,   // Minimum samples for detection
		autoUpdate: true, // Auto-update statistics
		values:     make([]float64, 0, 300),
	}
}

// UpdateParameters updates the statistical parameters
func (d *StatisticalDetector) UpdateParameters(mean, stdDev float64) error {
	if stdDev < 0 {
		return fmt.Errorf("standard deviation cannot be negative")
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	d.mean = mean
	d.stdDev = stdDev
	return nil
}

// Detect implements anomaly detection using statistical methods
func (d *StatisticalDetector) Detect(ctx context.Context, value float64) (*Anomaly, error) {
	start := time.Now()
	defer func() {
		recordMetrics(TypeStatistical, d.dataType, nil, time.Since(start), nil)
	}()

	select {
	case <-ctx.Done():
		err := ctx.Err()
		recordMetrics(TypeStatistical, d.dataType, nil, time.Since(start), err)
		return nil, err
	default:
		d.mu.RLock()
		mean := d.mean
		stdDev := d.stdDev
		d.mu.RUnlock()

		if stdDev == 0 {
			return nil, nil
		}

		zScore := math.Abs((value - mean) / stdDev)
		if zScore > d.threshold {
			severity := "warning"
			if zScore > d.threshold*2 {
				severity = "critical"
			}

			anomaly := &Anomaly{
				Timestamp: time.Now(),
				Type:      d.dataType,
				Severity:  severity,
				Value:     value,
				Threshold: d.threshold,
				Source:    "statistical",
			}

			recordMetrics(TypeStatistical, d.dataType, anomaly, time.Since(start), nil)
			return anomaly, nil
		}

		return nil, nil
	}
}

// UpdateThreshold updates the detection threshold
func (d *StatisticalDetector) UpdateThreshold(threshold float64) error {
	if threshold < 0 {
		return fmt.Errorf("threshold cannot be negative")
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	d.threshold = threshold
	return nil
}

// IsAnomaly checks if values are anomalous and returns a score
func (d *StatisticalDetector) IsAnomaly(values []float64) (bool, float64, error) {
	if len(values) == 0 {
		return false, 0, fmt.Errorf("empty values slice")
	}

	// Для простоты используем только последнее значение
	value := values[len(values)-1]

	d.mu.RLock()
	mean := d.mean
	stdDev := d.stdDev
	threshold := d.threshold
	d.mu.RUnlock()

	if stdDev == 0 {
		return false, 0, nil
	}

	zScore := math.Abs((value - mean) / stdDev)
	return zScore > threshold, zScore, nil
}

// Type returns the type of detector
func (d *StatisticalDetector) Type() string {
	return string(TypeStatistical)
}

// Configure updates detector configuration
func (d *StatisticalDetector) Configure(config DetectorConfig) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if config.Threshold > 0 {
		d.threshold = config.Threshold
	}

	// Handle parameters from map
	if config.Parameters != nil {
		if windowSize, ok := config.Parameters["windowSize"].(float64); ok && windowSize > 0 {
			d.windowSize = int(windowSize)
			// Resize values slice if needed
			if len(d.values) > d.windowSize {
				d.values = d.values[len(d.values)-d.windowSize:]
			}
		}

		if minSamples, ok := config.Parameters["minSamples"].(float64); ok && minSamples > 0 {
			d.minSamples = int(minSamples)
		}

		if autoUpdate, ok := config.Parameters["autoUpdate"].(bool); ok {
			d.autoUpdate = autoUpdate
		}

		if useMAD, ok := config.Parameters["useMAD"].(bool); ok {
			d.useMAD = useMAD
		}
	}

	// Handle legacy fields
	if config.WindowSize > 0 {
		d.windowSize = config.WindowSize
	}
	if config.MinSamples > 0 {
		d.minSamples = config.MinSamples
	}

	return nil
}

// GetStatistics returns detector statistics
func (d *StatisticalDetector) GetStatistics() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	stats := map[string]interface{}{
		"mean":            d.mean,
		"stdDev":          d.stdDev,
		"median":          d.median,
		"mad":             d.mad,
		"threshold":       d.threshold,
		"sampleCount":     len(d.values),
		"detectionCount":  d.detectionCount,
		"anomalyCount":    d.anomalyCount,
		"lastComputation": d.lastComputation,
		"windowSize":      d.windowSize,
		"minSamples":      d.minSamples,
		"autoUpdate":      d.autoUpdate,
		"useMAD":          d.useMAD,
	}

	if d.detectionCount > 0 {
		stats["anomalyRate"] = float64(d.anomalyCount) / float64(d.detectionCount)
	}

	return stats
}

// Health returns health status of the detector
func (d *StatisticalDetector) Health() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	health := map[string]interface{}{
		"status":          "healthy",
		"lastComputation": d.lastComputation,
		"sampleCount":     len(d.values),
		"detectionCount":  d.detectionCount,
		"anomalyCount":    d.anomalyCount,
	}

	// Check if statistics are stale
	if time.Since(d.lastComputation) > 5*time.Minute {
		health["status"] = "stale"
		health["warning"] = "Statistics not updated recently"
	}

	// Check if we have enough samples
	if len(d.values) < d.minSamples {
		health["status"] = "insufficient_data"
		health["warning"] = fmt.Sprintf("Need at least %d samples, have %d", d.minSamples, len(d.values))
	}

	return health
}

// Train implements TrainableDetector interface
func (d *StatisticalDetector) Train(values []float64) error {
	if len(values) == 0 {
		return fmt.Errorf("training data cannot be empty")
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	// Add values to training set
	for _, value := range values {
		d.addValue(value)
	}

	// Recompute statistics
	d.computeStatistics()

	return nil
}

// addValue adds a new value to the sliding window (internal method)
func (d *StatisticalDetector) addValue(value float64) {
	d.values = append(d.values, value)

	// Maintain sliding window size
	if len(d.values) > d.windowSize {
		d.values = d.values[1:] // Remove oldest value
	}
}

// computeStatistics calculates mean, standard deviation, median, and MAD (internal method)
func (d *StatisticalDetector) computeStatistics() {
	if len(d.values) == 0 {
		return
	}

	// Calculate mean
	sum := 0.0
	for _, v := range d.values {
		sum += v
	}
	d.mean = sum / float64(len(d.values))

	// Calculate standard deviation
	sumSquaredDiff := 0.0
	for _, v := range d.values {
		diff := v - d.mean
		sumSquaredDiff += diff * diff
	}
	d.stdDev = math.Sqrt(sumSquaredDiff / float64(len(d.values)))

	// Calculate median and MAD if enabled
	if d.useMAD {
		d.calculateMedianAndMAD()
	}

	d.lastComputation = time.Now()
}

// calculateMedianAndMAD calculates median and Median Absolute Deviation (internal method)
func (d *StatisticalDetector) calculateMedianAndMAD() {
	if len(d.values) == 0 {
		return
	}

	// Create a copy of values for sorting
	sortedValues := make([]float64, len(d.values))
	copy(sortedValues, d.values)

	// Simple bubble sort for median calculation
	for i := 0; i < len(sortedValues); i++ {
		for j := 0; j < len(sortedValues)-1-i; j++ {
			if sortedValues[j] > sortedValues[j+1] {
				sortedValues[j], sortedValues[j+1] = sortedValues[j+1], sortedValues[j]
			}
		}
	}

	// Calculate median
	n := len(sortedValues)
	if n%2 == 0 {
		d.median = (sortedValues[n/2-1] + sortedValues[n/2]) / 2
	} else {
		d.median = sortedValues[n/2]
	}

	// Calculate MAD
	deviations := make([]float64, n)
	for i, v := range d.values {
		deviations[i] = math.Abs(v - d.median)
	}

	// Sort deviations
	for i := 0; i < len(deviations); i++ {
		for j := 0; j < len(deviations)-1-i; j++ {
			if deviations[j] > deviations[j+1] {
				deviations[j], deviations[j+1] = deviations[j+1], deviations[j]
			}
		}
	}

	// Calculate median of deviations
	if n%2 == 0 {
		d.mad = (deviations[n/2-1] + deviations[n/2]) / 2
	} else {
		d.mad = deviations[n/2]
	}
}

// recordMetrics records metrics for detector operations
func recordMetrics(detectorType DetectorType, dataType string, anomaly *Anomaly, duration time.Duration, err error) {
	// Record detection duration
	metrics.DetectionDuration.WithLabelValues(string(detectorType), dataType).Observe(duration.Seconds())

	// Record processed samples
	metrics.ProcessedSamples.WithLabelValues(string(detectorType), dataType).Inc()

	// Update last detection timestamp
	metrics.LastDetectionTimestamp.WithLabelValues(string(detectorType), dataType).Set(float64(time.Now().Unix()))

	if err != nil {
		// Record detection errors
		metrics.DetectionErrors.WithLabelValues(string(detectorType), dataType, "detection_error").Inc()
		return
	}

	if anomaly != nil {
		// Record detected anomaly
		metrics.AnomalyCounter.WithLabelValues(string(detectorType), dataType, anomaly.Severity).Inc()
	}
}

// NewDetector creates a new anomaly detector based on the provided configuration
func NewDetector(config DetectorConfig) (Detector, error) {
	// Record configuration update
	metrics.ConfigUpdates.WithLabelValues(string(config.Type), config.DataType, "attempt").Inc()

	var detector Detector
	var err error

	switch config.Type {
	case TypeStatistical:
		if config.MinSamples <= 0 {
			config.MinSamples = 30 // default value
		}
		detector = NewStatisticalDetector(config.Threshold, 0.0, 0.0, config.DataType)

	case TypeWindow:
		if config.WindowSize <= 0 {
			err = fmt.Errorf("window size must be positive")
			break
		}
		detector = NewWindowDetector(config.WindowSize, config.Threshold, config.DataType)

	case TypeIsolationForest:
		if config.NumTrees <= 0 {
			err = fmt.Errorf("number of trees must be positive")
			break
		}
		if config.SampleSize <= 0 {
			err = fmt.Errorf("sample size must be positive")
			break
		}
		detector = NewIsolationForestDetector(config.NumTrees, config.SampleSize, config.Threshold, config.DataType)

	default:
		err = fmt.Errorf("unknown detector type: %s", config.Type)
	}

	if err != nil {
		metrics.ConfigUpdates.WithLabelValues(string(config.Type), config.DataType, "error").Inc()
		return nil, err
	}

	// Record successful configuration
	metrics.ConfigUpdates.WithLabelValues(string(config.Type), config.DataType, "success").Inc()
	metrics.DetectorStatus.WithLabelValues(string(config.Type), config.DataType).Set(1)

	return detector, nil
}

// WindowDetector implements sliding window anomaly detection
type WindowDetector struct {
	windowSize int
	threshold  float64
	dataType   string
	values     []float64
	mu         sync.RWMutex
}

// NewWindowDetector creates a new window anomaly detector
func NewWindowDetector(windowSize int, threshold float64, dataType string) *WindowDetector {
	return &WindowDetector{
		windowSize: windowSize,
		threshold:  threshold,
		dataType:   dataType,
		values:     make([]float64, 0, windowSize),
		mu:         sync.RWMutex{},
	}
}

// Detect implements anomaly detection using sliding window statistics
func (d *WindowDetector) Detect(ctx context.Context, value float64) (*Anomaly, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		d.mu.Lock()
		// Добавляем новое значение в окно
		d.values = append(d.values, value)
		if len(d.values) > d.windowSize {
			d.values = d.values[1:]
		}

		// Вычисляем среднее и стандартное отклонение
		var sum float64
		for _, v := range d.values {
			sum += v
		}
		mean := sum / float64(len(d.values))

		var sumSq float64
		for _, v := range d.values {
			diff := v - mean
			sumSq += diff * diff
		}
		stdDev := math.Sqrt(sumSq / float64(len(d.values)))
		d.mu.Unlock()

		// Если мало данных или стандартное отклонение слишком маленькое, не обнаруживаем аномалии
		if len(d.values) < 2 || stdDev < 1e-10 {
			return nil, nil
		}

		// Вычисляем z-score
		zScore := math.Abs((value - mean) / stdDev)
		if zScore > d.threshold {
			severity := "warning"
			if zScore > d.threshold*2 {
				severity = "critical"
			}

			return &Anomaly{
				Timestamp: time.Now(),
				Type:      d.dataType,
				Severity:  severity,
				Value:     value,
				Threshold: d.threshold,
				Source:    "window",
			}, nil
		}

		return nil, nil
	}
}

// UpdateThreshold updates the detection threshold
func (d *WindowDetector) UpdateThreshold(threshold float64) error {
	if threshold < 0 {
		return fmt.Errorf("threshold cannot be negative")
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	d.threshold = threshold
	return nil
}

// IsAnomaly checks if values are anomalous and returns a score
func (d *WindowDetector) IsAnomaly(values []float64) (bool, float64, error) {
	if len(values) == 0 {
		return false, 0, fmt.Errorf("empty values slice")
	}

	value := values[len(values)-1]

	d.mu.RLock()
	windowValues := make([]float64, len(d.values))
	copy(windowValues, d.values)
	threshold := d.threshold
	d.mu.RUnlock()

	if len(windowValues) < 2 {
		return false, 0, nil
	}

	// Вычисляем среднее и стандартное отклонение
	var sum float64
	for _, v := range windowValues {
		sum += v
	}
	mean := sum / float64(len(windowValues))

	var sumSq float64
	for _, v := range windowValues {
		diff := v - mean
		sumSq += diff * diff
	}
	stdDev := math.Sqrt(sumSq / float64(len(windowValues)))

	if stdDev < 1e-10 {
		return false, 0, nil
	}

	zScore := math.Abs((value - mean) / stdDev)
	return zScore > threshold, zScore, nil
}

// Type returns the type of detector
func (d *WindowDetector) Type() string {
	return string(TypeWindow)
}

// Train trains the window detector with historical values
func (d *WindowDetector) Train(values []float64) error {
	if len(values) == 0 {
		return fmt.Errorf("empty values slice")
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	// Берем последние windowSize значений
	if len(values) > d.windowSize {
		values = values[len(values)-d.windowSize:]
	}

	d.values = make([]float64, len(values))
	copy(d.values, values)

	return nil
}

// IsolationForestDetector implements isolation forest anomaly detection
type IsolationForestDetector struct {
	numTrees   int
	sampleSize int
	threshold  float64
	dataType   string
	mu         sync.RWMutex
}

// NewIsolationForestDetector creates a new isolation forest anomaly detector
func NewIsolationForestDetector(numTrees int, sampleSize int, threshold float64, dataType string) *IsolationForestDetector {
	return &IsolationForestDetector{
		numTrees:   numTrees,
		sampleSize: sampleSize,
		threshold:  threshold,
		dataType:   dataType,
		mu:         sync.RWMutex{},
	}
}

// Detect implements anomaly detection using isolation forest
func (d *IsolationForestDetector) Detect(ctx context.Context, value float64) (*Anomaly, error) {
	// Здесь должна быть реальная реализация алгоритма Isolation Forest
	// Для упрощения, используем заглушку
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		// Эмуляция обнаружения аномалии
		anomalyScore := math.Abs(value) / 100.0

		if anomalyScore > d.threshold {
			severity := "warning"
			if anomalyScore > d.threshold*1.5 {
				severity = "critical"
			}

			return &Anomaly{
				Timestamp: time.Now(),
				Type:      d.dataType,
				Severity:  severity,
				Value:     value,
				Threshold: d.threshold,
				Source:    "isolation_forest",
			}, nil
		}

		return nil, nil
	}
}

// UpdateThreshold updates the detection threshold
func (d *IsolationForestDetector) UpdateThreshold(threshold float64) error {
	if threshold < 0 || threshold > 1 {
		return fmt.Errorf("threshold must be between 0 and 1")
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	d.threshold = threshold
	return nil
}

// IsAnomaly checks if values are anomalous and returns a score
func (d *IsolationForestDetector) IsAnomaly(values []float64) (bool, float64, error) {
	if len(values) == 0 {
		return false, 0, fmt.Errorf("empty values slice")
	}

	value := values[len(values)-1]

	// Эмуляция алгоритма Isolation Forest
	anomalyScore := math.Abs(value) / 100.0

	d.mu.RLock()
	threshold := d.threshold
	d.mu.RUnlock()

	return anomalyScore > threshold, anomalyScore, nil
}

// Type returns the type of detector
func (d *IsolationForestDetector) Type() string {
	return string(TypeIsolationForest)
}

// Train trains the isolation forest detector
func (d *IsolationForestDetector) Train(values []float64) error {
	if len(values) == 0 {
		return fmt.Errorf("empty values slice")
	}

	// Здесь должно быть обучение модели Isolation Forest
	// Для упрощения, используем заглушку

	return nil
}
