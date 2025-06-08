package datasource

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// QueryBuilder provides a fluent interface for building PromQL queries
type QueryBuilder struct {
	metric string
	labels map[string]string
	function string
	range_ string
	groupBy []string
	conditions []string
}

// NewQueryBuilder creates a new PromQL query builder
func NewQueryBuilder(metric string) *QueryBuilder {
	return &QueryBuilder{
		metric: metric,
		labels: make(map[string]string),
	}
}

// WithLabel adds a label selector to the query
func (qb *QueryBuilder) WithLabel(key, value string) *QueryBuilder {
	qb.labels[key] = value
	return qb
}

// WithFunction applies a function to the query
func (qb *QueryBuilder) WithFunction(fn string) *QueryBuilder {
	qb.function = fn
	return qb
}

// WithRange adds a time range to the query
func (qb *QueryBuilder) WithRange(duration string) *QueryBuilder {
	qb.range_ = duration
	return qb
}

// GroupBy adds group by labels
func (qb *QueryBuilder) GroupBy(labels ...string) *QueryBuilder {
	qb.groupBy = labels
	return qb
}

// Where adds a condition to the query
func (qb *QueryBuilder) Where(condition string) *QueryBuilder {
	qb.conditions = append(qb.conditions, condition)
	return qb
}

// Build constructs the final PromQL query
func (qb *QueryBuilder) Build() string {
	// Start with metric name
	query := qb.metric
	
	// Add labels
	if len(qb.labels) > 0 {
		var labelPairs []string
		for k, v := range qb.labels {
			labelPairs = append(labelPairs, fmt.Sprintf(`%s="%s"`, k, v))
		}
		query += "{" + strings.Join(labelPairs, ",") + "}"
	}
	
	// Add range if specified
	if qb.range_ != "" {
		query += "[" + qb.range_ + "]"
	}
	
	// Apply function if specified
	if qb.function != "" {
		if len(qb.groupBy) > 0 {
			query = fmt.Sprintf("%s(%s) by (%s)", qb.function, query, strings.Join(qb.groupBy, ","))
		} else {
			query = fmt.Sprintf("%s(%s)", qb.function, query)
		}
	}
	
	// Add conditions
	if len(qb.conditions) > 0 {
		for _, condition := range qb.conditions {
			query += " " + condition
		}
	}
	
	return query
}

// EnhancedPrometheusClient provides advanced Prometheus functionality
type EnhancedPrometheusClient struct {
	client        v1.API
	buffer        *MetricsBuffer
	config        *EnhancedConfig
	queryCache    *queryCache
	mu            sync.RWMutex
}

// EnhancedConfig contains configuration for the enhanced client
type EnhancedConfig struct {
	BufferSize      int
	BufferTimeout   time.Duration
	CacheDuration   time.Duration
	MaxRetries      int
	RetryDelay      time.Duration
	BatchSize       int
}

// DefaultEnhancedConfig returns default configuration
func DefaultEnhancedConfig() *EnhancedConfig {
	return &EnhancedConfig{
		BufferSize:    10000,
		BufferTimeout: 5 * time.Second,
		CacheDuration: 30 * time.Second,
		MaxRetries:    3,
		RetryDelay:    1 * time.Second,
		BatchSize:     1000,
	}
}

// NewEnhancedPrometheusClient creates an enhanced Prometheus client
func NewEnhancedPrometheusClient(address string, config *EnhancedConfig) (*EnhancedPrometheusClient, error) {
	if config == nil {
		config = DefaultEnhancedConfig()
	}
	
	client, err := api.NewClient(api.Config{
		Address: address,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}
	
	return &EnhancedPrometheusClient{
		client:     v1.NewAPI(client),
		buffer:     NewMetricsBuffer(config.BufferSize, config.BufferTimeout),
		config:     config,
		queryCache: newQueryCache(config.CacheDuration),
	}, nil
}

// QueryWithBuilder executes a query using the query builder
func (epc *EnhancedPrometheusClient) QueryWithBuilder(ctx context.Context, builder *QueryBuilder) ([]MetricResult, error) {
	query := builder.Build()
	return epc.Query(ctx, query)
}

// Query executes an instant query with caching and retry logic
func (epc *EnhancedPrometheusClient) Query(ctx context.Context, query string) ([]MetricResult, error) {
	// Check cache first
	if cached, found := epc.queryCache.get(query); found {
		return cached, nil
	}
	
	var result model.Value
	var warnings v1.Warnings
	var err error
	
	// Retry logic
	for attempt := 0; attempt <= epc.config.MaxRetries; attempt++ {
		result, warnings, err = epc.client.Query(ctx, query, time.Now())
		if err == nil {
			break
		}
		
		if attempt < epc.config.MaxRetries {
			time.Sleep(epc.config.RetryDelay * time.Duration(attempt+1))
		}
	}
	
	if err != nil {
		return nil, fmt.Errorf("query failed after %d attempts: %w", epc.config.MaxRetries+1, err)
	}
	
	if len(warnings) > 0 {
		// Log warnings
		fmt.Printf("Prometheus query warnings: %v\n", warnings)
	}
	
	metrics, err := parseQueryResult(result)
	if err != nil {
		return nil, err
	}
	
	// Cache the result
	epc.queryCache.set(query, metrics)
	
	return metrics, nil
}

// StreamMetrics starts streaming metrics to the buffer
func (epc *EnhancedPrometheusClient) StreamMetrics(ctx context.Context, queries []string, interval time.Duration) error {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			for _, query := range queries {
				go func(q string) {
					metrics, err := epc.Query(ctx, q)
					if err != nil {
						fmt.Printf("Error querying metrics: %v\n", err)
						return
					}
					
					// Add to buffer
					for _, metric := range metrics {
						epc.buffer.Add(metric)
					}
				}(query)
			}
		}
	}
}

// GetBufferedMetrics retrieves and clears buffered metrics
func (epc *EnhancedPrometheusClient) GetBufferedMetrics() []MetricResult {
	return epc.buffer.Flush()
}

// BatchQuery executes multiple queries in parallel
func (epc *EnhancedPrometheusClient) BatchQuery(ctx context.Context, queries []string) (map[string][]MetricResult, error) {
	results := make(map[string][]MetricResult)
	resultsChan := make(chan struct {
		query   string
		metrics []MetricResult
		err     error
	}, len(queries))
	
	// Execute queries in parallel
	var wg sync.WaitGroup
	for _, query := range queries {
		wg.Add(1)
		go func(q string) {
			defer wg.Done()
			
			metrics, err := epc.Query(ctx, q)
			resultsChan <- struct {
				query   string
				metrics []MetricResult
				err     error
			}{query: q, metrics: metrics, err: err}
		}(query)
	}
	
	// Wait for all queries to complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()
	
	// Collect results
	var errors []error
	for result := range resultsChan {
		if result.err != nil {
			errors = append(errors, result.err)
		} else {
			results[result.query] = result.metrics
		}
	}
	
	if len(errors) > 0 {
		return results, fmt.Errorf("batch query had %d errors", len(errors))
	}
	
	return results, nil
}

// MetricsBuffer provides buffering for metrics
type MetricsBuffer struct {
	buffer    []MetricResult
	capacity  int
	timeout   time.Duration
	mu        sync.Mutex
	flushChan chan struct{}
}

// NewMetricsBuffer creates a new metrics buffer
func NewMetricsBuffer(capacity int, timeout time.Duration) *MetricsBuffer {
	mb := &MetricsBuffer{
		buffer:    make([]MetricResult, 0, capacity),
		capacity:  capacity,
		timeout:   timeout,
		flushChan: make(chan struct{}, 1),
	}
	
	// Start auto-flush goroutine
	go mb.autoFlush()
	
	return mb
}

// Add adds a metric to the buffer
func (mb *MetricsBuffer) Add(metric MetricResult) {
	mb.mu.Lock()
	defer mb.mu.Unlock()
	
	mb.buffer = append(mb.buffer, metric)
	
	// Trigger flush if buffer is full
	if len(mb.buffer) >= mb.capacity {
		select {
		case mb.flushChan <- struct{}{}:
		default:
		}
	}
}

// Flush retrieves and clears the buffer
func (mb *MetricsBuffer) Flush() []MetricResult {
	mb.mu.Lock()
	defer mb.mu.Unlock()
	
	metrics := make([]MetricResult, len(mb.buffer))
	copy(metrics, mb.buffer)
	mb.buffer = mb.buffer[:0]
	
	return metrics
}

// autoFlush periodically flushes the buffer
func (mb *MetricsBuffer) autoFlush() {
	ticker := time.NewTicker(mb.timeout)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			mb.Flush()
		case <-mb.flushChan:
			mb.Flush()
		}
	}
}

// queryCache provides simple caching for query results
type queryCache struct {
	cache    map[string]cacheEntry
	duration time.Duration
	mu       sync.RWMutex
}

type cacheEntry struct {
	metrics   []MetricResult
	timestamp time.Time
}

func newQueryCache(duration time.Duration) *queryCache {
	return &queryCache{
		cache:    make(map[string]cacheEntry),
		duration: duration,
	}
}

func (qc *queryCache) get(query string) ([]MetricResult, bool) {
	qc.mu.RLock()
	defer qc.mu.RUnlock()
	
	entry, exists := qc.cache[query]
	if !exists {
		return nil, false
	}
	
	if time.Since(entry.timestamp) > qc.duration {
		return nil, false
	}
	
	return entry.metrics, true
}

func (qc *queryCache) set(query string, metrics []MetricResult) {
	qc.mu.Lock()
	defer qc.mu.Unlock()
	
	qc.cache[query] = cacheEntry{
		metrics:   metrics,
		timestamp: time.Now(),
	}
} 