// Package metrics provides Prometheus metrics for anomaly detection
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// AnomalyCounter counts detected anomalies by type and severity
	AnomalyCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aiops_anomalies_detected_total",
			Help: "Total number of anomalies detected",
		},
		[]string{"detector_type", "data_type", "severity"},
	)

	// DetectionDuration measures anomaly detection duration
	DetectionDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aiops_anomaly_detection_duration_seconds",
			Help:    "Time spent on anomaly detection",
			Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"detector_type", "data_type"},
	)

	// DetectorStatus tracks detector status (1 for active, 0 for inactive)
	DetectorStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aiops_detector_status",
			Help: "Current status of anomaly detectors",
		},
		[]string{"detector_type", "data_type"},
	)

	// ProcessedSamples counts processed data samples
	ProcessedSamples = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aiops_processed_samples_total",
			Help: "Total number of processed data samples",
		},
		[]string{"detector_type", "data_type"},
	)

	// LastDetectionTimestamp tracks last detection time
	LastDetectionTimestamp = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "aiops_last_detection_timestamp",
			Help: "Timestamp of last anomaly detection",
		},
		[]string{"detector_type", "data_type"},
	)

	// DetectionErrors counts detection errors
	DetectionErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aiops_detection_errors_total",
			Help: "Total number of detection errors",
		},
		[]string{"detector_type", "data_type", "error_type"},
	)

	// ConfigUpdates counts configuration updates
	ConfigUpdates = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aiops_config_updates_total",
			Help: "Total number of detector configuration updates",
		},
		[]string{"detector_type", "data_type", "status"},
	)

	// DataSourceLatency measures data source latency
	DataSourceLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aiops_data_source_latency_seconds",
			Help:    "Latency of data source operations",
			Buckets: []float64{.01, .05, .1, .25, .5, 1, 2.5, 5, 10},
		},
		[]string{"source_type", "operation"},
	)
)
