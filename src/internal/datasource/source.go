package datasource

import (
	"context"
	"fmt"
	"time"
)

// DataPoint represents a single data point from any source
type DataPoint struct {
	Timestamp time.Time
	Value     float64
	Labels    map[string]string
}

// SourceType represents different types of data sources
type SourceType string

const (
	// TypePrometheus represents Prometheus data source
	TypePrometheus SourceType = "prometheus"
	// TypeLogs represents log-based data source
	TypeLogs SourceType = "logs"
	// TypeHTTP represents HTTP API data source
	TypeHTTP SourceType = "http"
)

// DataSource interface defines methods for data collection
type DataSource interface {
	// Name returns the name of the data source
	Name() string
	// Type returns the type of the data source
	Type() SourceType
	// Collect retrieves data points from the source
	Collect(ctx context.Context) ([]DataPoint, error)
	// Close releases any resources used by the data source
	Close() error
}

// Config holds configuration for data sources
type Config struct {
	Type SourceType
	Name string

	// Prometheus specific
	PrometheusURL  string
	PrometheusAuth struct {
		Username string
		Password string
		Token    string
	}
	PromQL string

	// Log specific
	LogPath       string
	LogPattern    string
	ValueExtract  string
	TimestampFmt  string
	LabelExtract  map[string]string
	RotationCheck bool

	// HTTP specific
	HTTPURL     string
	HTTPMethod  string
	HTTPHeaders map[string]string
	JSONPath    string
	Interval    time.Duration
}

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
	if c.Name == "" {
		return fmt.Errorf("name is required")
	}

	switch c.Type {
	case TypePrometheus:
		if c.PrometheusURL == "" {
			return fmt.Errorf("prometheus URL is required")
		}
		if c.PromQL == "" {
			return fmt.Errorf("PromQL query is required")
		}

	case TypeLogs:
		if c.LogPath == "" {
			return fmt.Errorf("log path is required")
		}
		if c.LogPattern == "" {
			return fmt.Errorf("log pattern is required")
		}
		if c.ValueExtract == "" {
			return fmt.Errorf("value extraction pattern is required")
		}

	case TypeHTTP:
		if c.HTTPURL == "" {
			return fmt.Errorf("HTTP URL is required")
		}
		if c.JSONPath == "" {
			return fmt.Errorf("JSON path is required")
		}
		if c.Interval <= 0 {
			return fmt.Errorf("interval must be positive")
		}

	default:
		return fmt.Errorf("unknown source type: %s", c.Type)
	}

	return nil
}

// NewDataSource creates a new data source based on the provided configuration
func NewDataSource(config *Config) (DataSource, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	switch config.Type {
	case TypePrometheus:
		return NewPrometheusSource(config)
	case TypeLogs:
		return NewLogSource(config)
	case TypeHTTP:
		return NewHTTPSource(config)
	default:
		return nil, fmt.Errorf("unknown source type: %s", config.Type)
	}
}
