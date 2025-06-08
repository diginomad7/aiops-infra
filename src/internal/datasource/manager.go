package datasource

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/types"
)

// DataSourceManager manages all data source integrations
type DataSourceManager struct {
	promClient     *EnhancedPrometheusClient
	lokiClient     *EnhancedLokiClient
	metricsPipeline *MetricsPipeline
	lokiCollector  *LokiCollector
	healthMonitor  *HealthMonitor
	config         *DataSourceConfig
	mu             sync.RWMutex
	stopCh         chan struct{}
	wg             sync.WaitGroup
}

// DataSourceConfig contains configuration for data sources
type DataSourceConfig struct {
	PrometheusURL    string
	LokiURL          string
	CollectionInterval time.Duration
	HealthCheckInterval time.Duration
	EnableMetrics    bool
	EnableLogs       bool
	MaxRetries       int
	RetryDelay       time.Duration
}

// DefaultDataSourceConfig returns default configuration
func DefaultDataSourceConfig() *DataSourceConfig {
	return &DataSourceConfig{
		PrometheusURL:       "http://localhost:9090",
		LokiURL:            "http://localhost:3100",
		CollectionInterval:  30 * time.Second,
		HealthCheckInterval: 60 * time.Second,
		EnableMetrics:      true,
		EnableLogs:         true,
		MaxRetries:         3,
		RetryDelay:         5 * time.Second,
	}
}

// NewDataSourceManager creates a new data source manager
func NewDataSourceManager(config *DataSourceConfig, detectorStore DetectorStore) (*DataSourceManager, error) {
	if config == nil {
		config = DefaultDataSourceConfig()
	}

	dsm := &DataSourceManager{
		config: config,
		stopCh: make(chan struct{}),
	}

	// Initialize Prometheus client if enabled
	if config.EnableMetrics && config.PrometheusURL != "" {
		promClient, err := NewEnhancedPrometheusClient(config.PrometheusURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		dsm.promClient = promClient
		dsm.metricsPipeline = NewMetricsPipeline(promClient, detectorStore)
	}

	// Initialize Loki client if enabled
	if config.EnableLogs && config.LokiURL != "" {
		lokiClient, err := NewEnhancedLokiClient(config.LokiURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create Loki client: %w", err)
		}
		dsm.lokiClient = lokiClient
		
		// Create Loki collector with callback
		lokiCollector, err := NewLokiCollector(
			config.LokiURL,
			config.CollectionInterval,
			5*time.Minute,
			dsm.handleLogStream,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Loki collector: %w", err)
		}
		dsm.lokiCollector = lokiCollector
	}

	// Initialize health monitor
	dsm.healthMonitor = NewHealthMonitor(config.HealthCheckInterval)

	return dsm, nil
}

// Start begins data collection from all sources
func (dsm *DataSourceManager) Start(ctx context.Context) error {
	// Start metrics pipeline
	if dsm.metricsPipeline != nil {
		if err := dsm.metricsPipeline.Start(ctx); err != nil {
			return fmt.Errorf("failed to start metrics pipeline: %w", err)
		}
		log.Println("Metrics pipeline started")
	}

	// Start Loki collector
	if dsm.lokiCollector != nil {
		dsm.lokiCollector.Start(ctx)
		log.Println("Loki collector started")
	}

	// Start health monitoring
	dsm.wg.Add(1)
	go dsm.runHealthMonitor(ctx)

	log.Println("Data source manager started")
	return nil
}

// Stop stops all data collection
func (dsm *DataSourceManager) Stop() {
	close(dsm.stopCh)
	
	if dsm.metricsPipeline != nil {
		dsm.metricsPipeline.Stop()
	}
	
	if dsm.lokiCollector != nil {
		dsm.lokiCollector.Stop()
	}
	
	dsm.wg.Wait()
	log.Println("Data source manager stopped")
}

// AddMetricCollector adds a metric collector for a detector
func (dsm *DataSourceManager) AddMetricCollector(detectorID, query string, interval time.Duration) error {
	if dsm.metricsPipeline == nil {
		return fmt.Errorf("metrics pipeline not initialized")
	}

	return dsm.metricsPipeline.CreateCollectorForDetector(detectorID, query, interval)
}

// AddLogQuery adds a log query for monitoring
func (dsm *DataSourceManager) AddLogQuery(name, query string) error {
	if dsm.lokiCollector == nil {
		return fmt.Errorf("loki collector not initialized")
	}

	dsm.lokiCollector.AddQuery(name, query)
	return nil
}

// RemoveMetricCollector removes a metric collector
func (dsm *DataSourceManager) RemoveMetricCollector(detectorID string) {
	if dsm.metricsPipeline != nil {
		collectorID := fmt.Sprintf("detector_%s", detectorID)
		dsm.metricsPipeline.RemoveCollector(collectorID)
	}
}

// RemoveLogQuery removes a log query
func (dsm *DataSourceManager) RemoveLogQuery(name string) {
	if dsm.lokiCollector != nil {
		dsm.lokiCollector.RemoveQuery(name)
	}
}

// QueryMetrics executes a Prometheus query
func (dsm *DataSourceManager) QueryMetrics(ctx context.Context, query string) ([]MetricResult, error) {
	if dsm.promClient == nil {
		return nil, fmt.Errorf("prometheus client not initialized")
	}

	return dsm.promClient.Query(ctx, query)
}

// QueryMetricsWithBuilder executes a Prometheus query using builder
func (dsm *DataSourceManager) QueryMetricsWithBuilder(ctx context.Context, builder *QueryBuilder) ([]MetricResult, error) {
	if dsm.promClient == nil {
		return nil, fmt.Errorf("prometheus client not initialized")
	}

	return dsm.promClient.QueryWithBuilder(ctx, builder)
}

// QueryLogs executes a Loki query
func (dsm *DataSourceManager) QueryLogs(ctx context.Context, query string, start, end time.Time) ([]*types.LogStream, error) {
	if dsm.lokiClient == nil {
		return nil, fmt.Errorf("loki client not initialized")
	}

	return dsm.lokiClient.Query(ctx, query, start, end)
}

// QueryLogsWithBuilder executes a Loki query using builder
func (dsm *DataSourceManager) QueryLogsWithBuilder(ctx context.Context, builder *LogQLBuilder, start, end time.Time) ([]*types.LogStream, error) {
	if dsm.lokiClient == nil {
		return nil, fmt.Errorf("loki client not initialized")
	}

	return dsm.lokiClient.QueryWithBuilder(ctx, builder, start, end)
}

// AnalyzeLogs performs log analysis
func (dsm *DataSourceManager) AnalyzeLogs(ctx context.Context, query string, duration time.Duration) (*LogAnalysisResult, error) {
	if dsm.lokiClient == nil {
		return nil, fmt.Errorf("loki client not initialized")
	}

	return dsm.lokiClient.AnalyzeLogs(ctx, query, duration)
}

// GetHealthStatus returns the health status of all data sources
func (dsm *DataSourceManager) GetHealthStatus() *HealthStatus {
	dsm.mu.RLock()
	defer dsm.mu.RUnlock()

	return dsm.healthMonitor.GetStatus()
}

// GetCollectorStatus returns the status of all metric collectors
func (dsm *DataSourceManager) GetCollectorStatus() map[string]CollectorStatus {
	if dsm.metricsPipeline == nil {
		return map[string]CollectorStatus{}
	}

	return dsm.metricsPipeline.GetCollectorStatus()
}

// handleLogStream processes incoming log streams
func (dsm *DataSourceManager) handleLogStream(stream *types.LogStream) error {
	// Process log stream for anomaly detection
	anomalyCount := 0
	errorCount := 0

	for _, entry := range stream.Entries {
		// Simple anomaly detection based on log level and content
		if entry.Level == "error" || entry.Level == "fatal" {
			errorCount++
		}

		// Check for specific patterns
		if dsm.lokiClient != nil && dsm.lokiClient.isAnomaly(entry.Content) {
			anomalyCount++
			// TODO: Send anomaly event via WebSocket
			log.Printf("Log anomaly detected: %s", entry.Content)
		}
	}

	if anomalyCount > 0 || errorCount > 0 {
		log.Printf("Log analysis: %d anomalies, %d errors in stream", anomalyCount, errorCount)
	}

	return nil
}

// runHealthMonitor monitors the health of data sources
func (dsm *DataSourceManager) runHealthMonitor(ctx context.Context) {
	defer dsm.wg.Done()

	ticker := time.NewTicker(dsm.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-dsm.stopCh:
			return
		case <-ticker.C:
			dsm.checkHealth(ctx)
		}
	}
}

// checkHealth checks the health of all data sources
func (dsm *DataSourceManager) checkHealth(ctx context.Context) {
	status := &HealthStatus{
		PrometheusHealthy: false,
		LokiHealthy:       false,
		LastCheck:         time.Now(),
	}

	// Check Prometheus health
	if dsm.promClient != nil {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		// Simple health check query
		_, err := dsm.promClient.Query(ctx, "up")
		status.PrometheusHealthy = err == nil
		if err != nil {
			status.PrometheusError = err.Error()
		}
	}

	// Check Loki health
	if dsm.lokiClient != nil {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		// Simple health check query
		end := time.Now()
		start := end.Add(-1 * time.Minute)
		_, err := dsm.lokiClient.Query(ctx, `{job="loki"}`, start, end)
		status.LokiHealthy = err == nil
		if err != nil {
			status.LokiError = err.Error()
		}
	}

	// Update health monitor
	dsm.healthMonitor.UpdateStatus(status)
}

// CreateBuilders creates query builders for convenience
func (dsm *DataSourceManager) CreateBuilders() *QueryBuilders {
	return &QueryBuilders{
		Prometheus: NewQueryBuilder,
		Loki:       NewLogQLBuilder,
	}
}

// QueryBuilders provides convenient access to query builders
type QueryBuilders struct {
	Prometheus func(metric string) *QueryBuilder
	Loki       func(selector string) *LogQLBuilder
}

// HealthMonitor monitors data source health
type HealthMonitor struct {
	status   *HealthStatus
	interval time.Duration
	mu       sync.RWMutex
}

// HealthStatus represents the health of data sources
type HealthStatus struct {
	PrometheusHealthy bool
	LokiHealthy       bool
	PrometheusError   string
	LokiError         string
	LastCheck         time.Time
}

// NewHealthMonitor creates a new health monitor
func NewHealthMonitor(interval time.Duration) *HealthMonitor {
	return &HealthMonitor{
		interval: interval,
		status: &HealthStatus{
			PrometheusHealthy: false,
			LokiHealthy:       false,
			LastCheck:         time.Now(),
		},
	}
}

// UpdateStatus updates the health status
func (hm *HealthMonitor) UpdateStatus(status *HealthStatus) {
	hm.mu.Lock()
	defer hm.mu.Unlock()
	hm.status = status
}

// GetStatus returns the current health status
func (hm *HealthMonitor) GetStatus() *HealthStatus {
	hm.mu.RLock()
	defer hm.mu.RUnlock()
	
	// Return a copy to avoid race conditions
	return &HealthStatus{
		PrometheusHealthy: hm.status.PrometheusHealthy,
		LokiHealthy:       hm.status.LokiHealthy,
		PrometheusError:   hm.status.PrometheusError,
		LokiError:         hm.status.LokiError,
		LastCheck:         hm.status.LastCheck,
	}
}

// DataSourceIntegration provides a unified interface for detector integration
type DataSourceIntegration struct {
	manager       *DataSourceManager
	detectorStore DetectorStore
}

// NewDataSourceIntegration creates a new data source integration
func NewDataSourceIntegration(manager *DataSourceManager, detectorStore DetectorStore) *DataSourceIntegration {
	return &DataSourceIntegration{
		manager:       manager,
		detectorStore: detectorStore,
	}
}

// ConfigureDetectorDataSources configures data sources for a detector
func (dsi *DataSourceIntegration) ConfigureDetectorDataSources(detectorID string, config *DetectorDataSourceConfig) error {
	// Configure metrics collection
	if config.MetricQuery != "" {
		err := dsi.manager.AddMetricCollector(
			detectorID,
			config.MetricQuery,
			config.CollectionInterval,
		)
		if err != nil {
			return fmt.Errorf("failed to configure metric collector: %w", err)
		}
	}

	// Configure log monitoring
	if config.LogQuery != "" {
		err := dsi.manager.AddLogQuery(
			fmt.Sprintf("detector_%s", detectorID),
			config.LogQuery,
		)
		if err != nil {
			return fmt.Errorf("failed to configure log query: %w", err)
		}
	}

	return nil
}

// RemoveDetectorDataSources removes data source configuration for a detector
func (dsi *DataSourceIntegration) RemoveDetectorDataSources(detectorID string) {
	dsi.manager.RemoveMetricCollector(detectorID)
	dsi.manager.RemoveLogQuery(fmt.Sprintf("detector_%s", detectorID))
}

// DetectorDataSourceConfig contains data source configuration for a detector
type DetectorDataSourceConfig struct {
	MetricQuery        string
	LogQuery           string
	CollectionInterval time.Duration
} 