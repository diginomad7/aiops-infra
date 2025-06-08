package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/aiops-infra/src/internal/datasource"
)

// DataSourceAPI handles data source related API endpoints
type DataSourceAPI struct {
	manager *datasource.DataSourceManager
}

// NewDataSourceAPI creates a new data source API handler
func NewDataSourceAPI(manager *datasource.DataSourceManager) *DataSourceAPI {
	return &DataSourceAPI{
		manager: manager,
	}
}

// SetupRoutes configures data source API routes
func (api *DataSourceAPI) SetupRoutes(router *gin.RouterGroup) {
	// Data source health and status
	router.GET("/health", api.handleGetDataSourceHealth)
	router.GET("/collectors", api.handleGetCollectors)
	
	// Prometheus endpoints
	prometheus := router.Group("/prometheus")
	{
		prometheus.POST("/query", api.handlePrometheusQuery)
		prometheus.POST("/query-builder", api.handlePrometheusQueryBuilder)
		prometheus.POST("/batch-query", api.handlePrometheusBatchQuery)
		prometheus.GET("/metrics/buffered", api.handleGetBufferedMetrics)
	}
	
	// Loki endpoints
	loki := router.Group("/loki")
	{
		loki.POST("/query", api.handleLokiQuery)
		loki.POST("/query-builder", api.handleLokiQueryBuilder)
		loki.POST("/analyze", api.handleLokiAnalyze)
	}
	
	// Detector data source configuration
	router.POST("/detectors/:id/datasources", api.handleConfigureDetectorDataSources)
	router.DELETE("/detectors/:id/datasources", api.handleRemoveDetectorDataSources)
}

// handleGetDataSourceHealth returns the health status of all data sources
func (api *DataSourceAPI) handleGetDataSourceHealth(c *gin.Context) {
	status := api.manager.GetHealthStatus()
	
	httpStatus := http.StatusOK
	if !status.PrometheusHealthy || !status.LokiHealthy {
		httpStatus = http.StatusServiceUnavailable
	}
	
	c.JSON(httpStatus, gin.H{
		"prometheus": gin.H{
			"healthy": status.PrometheusHealthy,
			"error":   status.PrometheusError,
		},
		"loki": gin.H{
			"healthy": status.LokiHealthy,
			"error":   status.LokiError,
		},
		"last_check": status.LastCheck,
	})
}

// handleGetCollectors returns the status of all metric collectors
func (api *DataSourceAPI) handleGetCollectors(c *gin.Context) {
	collectors := api.manager.GetCollectorStatus()
	
	c.JSON(http.StatusOK, gin.H{
		"collectors": collectors,
		"count":      len(collectors),
	})
}

// PrometheusQueryRequest represents a Prometheus query request
type PrometheusQueryRequest struct {
	Query string `json:"query" binding:"required"`
}

// handlePrometheusQuery executes a Prometheus query
func (api *DataSourceAPI) handlePrometheusQuery(c *gin.Context) {
	var req PrometheusQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	ctx := c.Request.Context()
	results, err := api.manager.QueryMetrics(ctx, req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"count":   len(results),
	})
}

// PrometheusQueryBuilderRequest represents a query builder request
type PrometheusQueryBuilderRequest struct {
	Metric     string            `json:"metric" binding:"required"`
	Labels     map[string]string `json:"labels,omitempty"`
	Function   string            `json:"function,omitempty"`
	Range      string            `json:"range,omitempty"`
	GroupBy    []string          `json:"group_by,omitempty"`
	Conditions []string          `json:"conditions,omitempty"`
}

// handlePrometheusQueryBuilder executes a Prometheus query using the builder
func (api *DataSourceAPI) handlePrometheusQueryBuilder(c *gin.Context) {
	var req PrometheusQueryBuilderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Build query
	builder := datasource.NewQueryBuilder(req.Metric)
	
	// Add labels
	for key, value := range req.Labels {
		builder.WithLabel(key, value)
	}
	
	// Add function
	if req.Function != "" {
		builder.WithFunction(req.Function)
	}
	
	// Add range
	if req.Range != "" {
		builder.WithRange(req.Range)
	}
	
	// Add group by
	if len(req.GroupBy) > 0 {
		builder.GroupBy(req.GroupBy...)
	}
	
	// Add conditions
	for _, condition := range req.Conditions {
		builder.Where(condition)
	}
	
	// Execute query
	ctx := c.Request.Context()
	results, err := api.manager.QueryMetricsWithBuilder(ctx, builder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"query":   builder.Build(),
		"results": results,
		"count":   len(results),
	})
}

// PrometheusBatchQueryRequest represents a batch query request
type PrometheusBatchQueryRequest struct {
	Queries []string `json:"queries" binding:"required"`
}

// handlePrometheusBatchQuery executes multiple Prometheus queries
func (api *DataSourceAPI) handlePrometheusBatchQuery(c *gin.Context) {
	var req PrometheusBatchQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if len(req.Queries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one query is required"})
		return
	}
	
	if len(req.Queries) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 10 queries allowed"})
		return
	}
	
	// TODO: Implement batch query in manager
	
	c.JSON(http.StatusOK, gin.H{
		"message": "batch query execution not yet implemented",
	})
}

// handleGetBufferedMetrics retrieves buffered metrics
func (api *DataSourceAPI) handleGetBufferedMetrics(c *gin.Context) {
	// TODO: Implement buffered metrics retrieval
	c.JSON(http.StatusOK, gin.H{
		"metrics": []interface{}{},
		"count":   0,
	})
}

// LokiQueryRequest represents a Loki query request
type LokiQueryRequest struct {
	Query string    `json:"query" binding:"required"`
	Start time.Time `json:"start,omitempty"`
	End   time.Time `json:"end,omitempty"`
}

// handleLokiQuery executes a Loki query
func (api *DataSourceAPI) handleLokiQuery(c *gin.Context) {
	var req LokiQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Default time range if not specified
	if req.End.IsZero() {
		req.End = time.Now()
	}
	if req.Start.IsZero() {
		req.Start = req.End.Add(-1 * time.Hour)
	}
	
	ctx := c.Request.Context()
	results, err := api.manager.QueryLogs(ctx, req.Query, req.Start, req.End)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"streams": results,
		"count":   len(results),
	})
}

// LokiQueryBuilderRequest represents a LogQL builder request
type LokiQueryBuilderRequest struct {
	Selector    string   `json:"selector" binding:"required"`
	Filters     []string `json:"filters,omitempty"`
	Parsers     []string `json:"parsers,omitempty"`
	Formatters  []string `json:"formatters,omitempty"`
	Aggregation string   `json:"aggregation,omitempty"`
	Duration    string   `json:"duration,omitempty"`
	GroupBy     []string `json:"group_by,omitempty"`
	Start       time.Time `json:"start,omitempty"`
	End         time.Time `json:"end,omitempty"`
}

// handleLokiQueryBuilder executes a Loki query using the builder
func (api *DataSourceAPI) handleLokiQueryBuilder(c *gin.Context) {
	var req LokiQueryBuilderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Build query
	builder := datasource.NewLogQLBuilder(req.Selector)
	
	// Add filters
	for _, filter := range req.Filters {
		builder.Filter(filter)
	}
	
	// Add parsers
	for _, parser := range req.Parsers {
		switch parser {
		case "json":
			builder.Json()
		case "logfmt":
			builder.Logfmt()
		default:
			if len(parser) > 8 && parser[:8] == "pattern:" {
				builder.Pattern(parser[8:])
			} else if len(parser) > 7 && parser[:7] == "regexp:" {
				builder.Regexp(parser[7:])
			}
		}
	}
	
	// Add formatters
	for _, formatter := range req.Formatters {
		if len(formatter) > 5 && formatter[:5] == "line:" {
			builder.Line(formatter[5:])
		} else if len(formatter) > 6 && formatter[:6] == "label:" {
			builder.Label(formatter[6:])
		}
	}
	
	// Add aggregation
	if req.Aggregation != "" && req.Duration != "" {
		switch req.Aggregation {
		case "rate":
			builder.Rate(req.Duration)
		case "count_over_time":
			builder.CountOverTime(req.Duration)
		}
		
		if len(req.GroupBy) > 0 {
			builder.By(req.GroupBy...)
		}
	}
	
	// Default time range
	if req.End.IsZero() {
		req.End = time.Now()
	}
	if req.Start.IsZero() {
		req.Start = req.End.Add(-1 * time.Hour)
	}
	
	// Execute query
	ctx := c.Request.Context()
	results, err := api.manager.QueryLogsWithBuilder(ctx, builder, req.Start, req.End)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"query":   builder.Build(),
		"streams": results,
		"count":   len(results),
	})
}

// LokiAnalyzeRequest represents a log analysis request
type LokiAnalyzeRequest struct {
	Query    string `json:"query" binding:"required"`
	Duration string `json:"duration,omitempty"`
}

// handleLokiAnalyze performs log analysis
func (api *DataSourceAPI) handleLokiAnalyze(c *gin.Context) {
	var req LokiAnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Default duration
	duration := 1 * time.Hour
	if req.Duration != "" {
		parsed, err := time.ParseDuration(req.Duration)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duration format"})
			return
		}
		duration = parsed
	}
	
	ctx := c.Request.Context()
	results, err := api.manager.AnalyzeLogs(ctx, req.Query, duration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, results)
}

// DetectorDataSourceRequest represents a detector data source configuration request
type DetectorDataSourceRequest struct {
	MetricQuery        string `json:"metric_query,omitempty"`
	LogQuery           string `json:"log_query,omitempty"`
	CollectionInterval string `json:"collection_interval,omitempty"`
}

// handleConfigureDetectorDataSources configures data sources for a detector
func (api *DataSourceAPI) handleConfigureDetectorDataSources(c *gin.Context) {
	detectorID := c.Param("id")
	if detectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "detector ID is required"})
		return
	}
	
	var req DetectorDataSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Parse collection interval
	interval := 30 * time.Second
	if req.CollectionInterval != "" {
		parsed, err := time.ParseDuration(req.CollectionInterval)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection interval format"})
			return
		}
		interval = parsed
	}
	
	// Configure data sources
	config := &datasource.DetectorDataSourceConfig{
		MetricQuery:        req.MetricQuery,
		LogQuery:           req.LogQuery,
		CollectionInterval: interval,
	}
	
	// TODO: Need to get data source integration from manager
	// For now, return success
	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"detector_id": detectorID,
		"config":      config,
	})
}

// handleRemoveDetectorDataSources removes data source configuration for a detector
func (api *DataSourceAPI) handleRemoveDetectorDataSources(c *gin.Context) {
	detectorID := c.Param("id")
	if detectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "detector ID is required"})
		return
	}
	
	// TODO: Need to get data source integration from manager
	// For now, return success
	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"detector_id": detectorID,
		"message":     "data sources removed",
	})
} 