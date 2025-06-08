package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/types"
)

// LogQLBuilder provides a fluent interface for building LogQL queries
type LogQLBuilder struct {
	selector       string
	filters        []string
	parsers        []string
	formatters     []string
	aggregations   []string
	unwrap         string
	by             []string
	withoutBy      []string
	over           string
}

// NewLogQLBuilder creates a new LogQL query builder
func NewLogQLBuilder(selector string) *LogQLBuilder {
	return &LogQLBuilder{
		selector: selector,
	}
}

// Filter adds a line filter to the query
func (lb *LogQLBuilder) Filter(filter string) *LogQLBuilder {
	lb.filters = append(lb.filters, filter)
	return lb
}

// Contains adds a contains filter
func (lb *LogQLBuilder) Contains(text string) *LogQLBuilder {
	return lb.Filter(fmt.Sprintf(`|~ "%s"`, text))
}

// NotContains adds a not contains filter
func (lb *LogQLBuilder) NotContains(text string) *LogQLBuilder {
	return lb.Filter(fmt.Sprintf(`!~ "%s"`, text))
}

// Json adds JSON parser
func (lb *LogQLBuilder) Json() *LogQLBuilder {
	lb.parsers = append(lb.parsers, "| json")
	return lb
}

// Logfmt adds logfmt parser
func (lb *LogQLBuilder) Logfmt() *LogQLBuilder {
	lb.parsers = append(lb.parsers, "| logfmt")
	return lb
}

// Pattern adds pattern parser
func (lb *LogQLBuilder) Pattern(pattern string) *LogQLBuilder {
	lb.parsers = append(lb.parsers, fmt.Sprintf(`| pattern "%s"`, pattern))
	return lb
}

// Regexp adds regexp parser
func (lb *LogQLBuilder) Regexp(pattern string) *LogQLBuilder {
	lb.parsers = append(lb.parsers, fmt.Sprintf(`| regexp "%s"`, pattern))
	return lb
}

// Line adds line format
func (lb *LogQLBuilder) Line(format string) *LogQLBuilder {
	lb.formatters = append(lb.formatters, fmt.Sprintf(`| line_format "%s"`, format))
	return lb
}

// Label adds label format
func (lb *LogQLBuilder) Label(labelFormats ...string) *LogQLBuilder {
	for _, format := range labelFormats {
		lb.formatters = append(lb.formatters, fmt.Sprintf(`| label_format %s`, format))
	}
	return lb
}

// Unwrap sets the unwrap expression for metric queries
func (lb *LogQLBuilder) Unwrap(label string) *LogQLBuilder {
	lb.unwrap = label
	return lb
}

// Rate adds rate aggregation
func (lb *LogQLBuilder) Rate(duration string) *LogQLBuilder {
	lb.aggregations = append(lb.aggregations, fmt.Sprintf("rate(%s[%s])", lb.buildLogQuery(), duration))
	return lb
}

// CountOverTime adds count_over_time aggregation
func (lb *LogQLBuilder) CountOverTime(duration string) *LogQLBuilder {
	query := lb.buildLogQuery()
	if lb.unwrap != "" {
		query += fmt.Sprintf(" | unwrap %s", lb.unwrap)
	}
	lb.aggregations = append(lb.aggregations, fmt.Sprintf("count_over_time(%s[%s])", query, duration))
	return lb
}

// Sum adds sum aggregation
func (lb *LogQLBuilder) Sum() *LogQLBuilder {
	if len(lb.aggregations) > 0 {
		lb.aggregations[len(lb.aggregations)-1] = fmt.Sprintf("sum(%s)", lb.aggregations[len(lb.aggregations)-1])
	}
	return lb
}

// Avg adds avg aggregation
func (lb *LogQLBuilder) Avg() *LogQLBuilder {
	if len(lb.aggregations) > 0 {
		lb.aggregations[len(lb.aggregations)-1] = fmt.Sprintf("avg(%s)", lb.aggregations[len(lb.aggregations)-1])
	}
	return lb
}

// By groups by labels
func (lb *LogQLBuilder) By(labels ...string) *LogQLBuilder {
	lb.by = labels
	return lb
}

// Without groups without labels
func (lb *LogQLBuilder) Without(labels ...string) *LogQLBuilder {
	lb.withoutBy = labels
	return lb
}

// Over sets the time range
func (lb *LogQLBuilder) Over(duration string) *LogQLBuilder {
	lb.over = duration
	return lb
}

// buildLogQuery builds the log query part
func (lb *LogQLBuilder) buildLogQuery() string {
	parts := []string{lb.selector}
	parts = append(parts, lb.filters...)
	parts = append(parts, lb.parsers...)
	parts = append(parts, lb.formatters...)
	return strings.Join(parts, " ")
}

// Build constructs the final LogQL query
func (lb *LogQLBuilder) Build() string {
	if len(lb.aggregations) > 0 {
		query := lb.aggregations[len(lb.aggregations)-1]
		if len(lb.by) > 0 {
			query += fmt.Sprintf(" by (%s)", strings.Join(lb.by, ", "))
		} else if len(lb.withoutBy) > 0 {
			query += fmt.Sprintf(" without (%s)", strings.Join(lb.withoutBy, ", "))
		}
		return query
	}
	
	return lb.buildLogQuery()
}

// EnhancedLokiClient provides advanced Loki functionality
type EnhancedLokiClient struct {
	baseURL        string
	client         *http.Client
	patternCache   *patternCache
	analysisConfig *LogAnalysisConfig
	mu             sync.RWMutex
}

// LogAnalysisConfig contains configuration for log analysis
type LogAnalysisConfig struct {
	AnomalyPatterns    []*regexp.Regexp
	ErrorPatterns      []*regexp.Regexp
	PerformancePattern *regexp.Regexp
	MaxSampleSize      int
	AnalysisWindow     time.Duration
}

// DefaultLogAnalysisConfig returns default log analysis configuration
func DefaultLogAnalysisConfig() *LogAnalysisConfig {
	return &LogAnalysisConfig{
		AnomalyPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(exception|error|fail|panic|fatal)`),
			regexp.MustCompile(`(?i)(timeout|refused|denied)`),
			regexp.MustCompile(`(?i)(out of memory|oom|killed)`),
		},
		ErrorPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)error\s*[:=]\s*(.+)`),
			regexp.MustCompile(`(?i)exception\s*[:=]\s*(.+)`),
			regexp.MustCompile(`(?i)failed\s+to\s+(.+)`),
		},
		PerformancePattern: regexp.MustCompile(`(?i)(?:latency|duration|time|took)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(ms|s|m)`),
		MaxSampleSize:      10000,
		AnalysisWindow:     5 * time.Minute,
	}
}

// NewEnhancedLokiClient creates an enhanced Loki client
func NewEnhancedLokiClient(baseURL string, config *LogAnalysisConfig) (*EnhancedLokiClient, error) {
	if config == nil {
		config = DefaultLogAnalysisConfig()
	}
	
	return &EnhancedLokiClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		patternCache:   newPatternCache(1000),
		analysisConfig: config,
	}, nil
}

// QueryWithBuilder executes a query using the query builder
func (elc *EnhancedLokiClient) QueryWithBuilder(ctx context.Context, builder *LogQLBuilder, start, end time.Time) ([]*types.LogStream, error) {
	query := builder.Build()
	return elc.Query(ctx, query, start, end)
}

// Query executes a LogQL query
func (elc *EnhancedLokiClient) Query(ctx context.Context, query string, start, end time.Time) ([]*types.LogStream, error) {
	queryURL, err := url.Parse(fmt.Sprintf("%s/loki/api/v1/query_range", elc.baseURL))
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}
	
	params := url.Values{}
	params.Add("query", query)
	params.Add("start", fmt.Sprintf("%d", start.UnixNano()))
	params.Add("end", fmt.Sprintf("%d", end.UnixNano()))
	params.Add("limit", fmt.Sprintf("%d", elc.analysisConfig.MaxSampleSize))
	queryURL.RawQuery = params.Encode()
	
	req, err := http.NewRequestWithContext(ctx, "GET", queryURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	resp, err := elc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Loki returned error status: %d", resp.StatusCode)
	}
	
	var lokiResponse LokiQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&lokiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	if lokiResponse.Status != "success" {
		return nil, fmt.Errorf("Loki query failed: %s", lokiResponse.Status)
	}
	
	return elc.parseStreams(lokiResponse.Data.Result), nil
}

// AnalyzeLogs performs advanced log analysis
func (elc *EnhancedLokiClient) AnalyzeLogs(ctx context.Context, query string, duration time.Duration) (*LogAnalysisResult, error) {
	end := time.Now()
	start := end.Add(-duration)
	
	streams, err := elc.Query(ctx, query, start, end)
	if err != nil {
		return nil, err
	}
	
	result := &LogAnalysisResult{
		TotalLogs:       0,
		AnomalyCount:    0,
		ErrorCount:      0,
		PatternSummary:  make(map[string]int),
		ErrorTypes:      make(map[string]int),
		PerformanceData: make([]PerformanceMetric, 0),
		TimeDistribution: make(map[string]int),
	}
	
	// Analyze each log stream
	for _, stream := range streams {
		for _, entry := range stream.Entries {
			result.TotalLogs++
			
			// Check for anomalies
			if elc.isAnomaly(entry.Content) {
				result.AnomalyCount++
			}
			
			// Extract error types
			if errorType := elc.extractErrorType(entry.Content); errorType != "" {
				result.ErrorCount++
				result.ErrorTypes[errorType]++
			}
			
			// Extract performance metrics
			if perf := elc.extractPerformanceMetric(entry.Content); perf != nil {
				result.PerformanceData = append(result.PerformanceData, *perf)
			}
			
			// Time distribution (hourly buckets)
			hour := entry.Timestamp.Format("2006-01-02 15:00")
			result.TimeDistribution[hour]++
			
			// Pattern detection
			pattern := elc.detectPattern(entry.Content)
			if pattern != "" {
				result.PatternSummary[pattern]++
			}
		}
	}
	
	// Calculate additional metrics
	result.AnomalyRate = float64(result.AnomalyCount) / float64(result.TotalLogs)
	result.ErrorRate = float64(result.ErrorCount) / float64(result.TotalLogs)
	
	return result, nil
}

// isAnomaly checks if a log entry is anomalous
func (elc *EnhancedLokiClient) isAnomaly(content string) bool {
	for _, pattern := range elc.analysisConfig.AnomalyPatterns {
		if pattern.MatchString(content) {
			return true
		}
	}
	return false
}

// extractErrorType extracts the error type from log content
func (elc *EnhancedLokiClient) extractErrorType(content string) string {
	for _, pattern := range elc.analysisConfig.ErrorPatterns {
		if matches := pattern.FindStringSubmatch(content); len(matches) > 1 {
			return strings.TrimSpace(matches[1])
		}
	}
	return ""
}

// extractPerformanceMetric extracts performance data from log content
func (elc *EnhancedLokiClient) extractPerformanceMetric(content string) *PerformanceMetric {
	matches := elc.analysisConfig.PerformancePattern.FindStringSubmatch(content)
	if len(matches) < 3 {
		return nil
	}
	
	value := 0.0
	fmt.Sscanf(matches[1], "%f", &value)
	
	// Convert to milliseconds
	unit := matches[2]
	switch unit {
	case "s":
		value *= 1000
	case "m":
		value *= 60000
	}
	
	return &PerformanceMetric{
		Value: value,
		Unit:  "ms",
	}
}

// detectPattern detects common patterns in log entries
func (elc *EnhancedLokiClient) detectPattern(content string) string {
	// Check cache first
	if pattern, found := elc.patternCache.get(content); found {
		return pattern
	}
	
	// Simple pattern detection (can be enhanced)
	pattern := ""
	if strings.Contains(content, "HTTP") && strings.Contains(content, "200") {
		pattern = "http_success"
	} else if strings.Contains(content, "HTTP") && strings.Contains(content, "5") {
		pattern = "http_error"
	} else if strings.Contains(content, "connection") && strings.Contains(content, "refused") {
		pattern = "connection_error"
	} else if strings.Contains(content, "timeout") {
		pattern = "timeout_error"
	}
	
	// Cache the result
	elc.patternCache.set(content, pattern)
	
	return pattern
}

// parseStreams converts Loki response to LogStream format
func (elc *EnhancedLokiClient) parseStreams(results []LokiStreamResult) []*types.LogStream {
	streams := make([]*types.LogStream, 0, len(results))
	
	for _, result := range results {
		stream := &types.LogStream{
			Labels:  result.Stream,
			Entries: make([]types.LogEntry, 0, len(result.Values)),
		}
		
		for _, value := range result.Values {
			if len(value) != 2 {
				continue
			}
			
			var timestampNano int64
			fmt.Sscanf(value[0], "%d", &timestampNano)
			
			entry := types.LogEntry{
				Timestamp: time.Unix(0, timestampNano),
				Content:   value[1],
				Labels:    result.Stream,
				Level:     extractLogLevel(value[1]),
			}
			
			stream.Entries = append(stream.Entries, entry)
		}
		
		if len(stream.Entries) > 0 {
			streams = append(streams, stream)
		}
	}
	
	return streams
}

// LogAnalysisResult contains the results of log analysis
type LogAnalysisResult struct {
	TotalLogs        int
	AnomalyCount     int
	ErrorCount       int
	AnomalyRate      float64
	ErrorRate        float64
	PatternSummary   map[string]int
	ErrorTypes       map[string]int
	PerformanceData  []PerformanceMetric
	TimeDistribution map[string]int
}

// PerformanceMetric represents a performance measurement
type PerformanceMetric struct {
	Value float64
	Unit  string
}

// LokiQueryResponse represents Loki API response
type LokiQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string              `json:"resultType"`
		Result     []LokiStreamResult  `json:"result"`
	} `json:"data"`
}

// LokiStreamResult represents a single stream result
type LokiStreamResult struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

// patternCache provides simple caching for pattern detection
type patternCache struct {
	cache map[uint32]string
	mu    sync.RWMutex
	size  int
}

func newPatternCache(size int) *patternCache {
	return &patternCache{
		cache: make(map[uint32]string),
		size:  size,
	}
}

func (pc *patternCache) get(content string) (string, bool) {
	pc.mu.RLock()
	defer pc.mu.RUnlock()
	
	hash := hashString(content)
	pattern, found := pc.cache[hash]
	return pattern, found
}

func (pc *patternCache) set(content, pattern string) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	
	if len(pc.cache) >= pc.size {
		// Simple eviction - remove first item
		for k := range pc.cache {
			delete(pc.cache, k)
			break
		}
	}
	
	hash := hashString(content)
	pc.cache[hash] = pattern
}

// hashString provides a simple hash function
func hashString(s string) uint32 {
	h := uint32(0)
	for _, c := range s {
		h = h*31 + uint32(c)
	}
	return h
} 