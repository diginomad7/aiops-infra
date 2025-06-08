package api

import (
	"encoding/json"
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// LogLevel represents different log levels
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
	LogLevelFatal LogLevel = "FATAL"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Level      LogLevel    `json:"level"`
	Timestamp  time.Time   `json:"timestamp"`
	Message    string      `json:"message"`
	Component  string      `json:"component"`
	RequestID  string      `json:"request_id,omitempty"`
	UserID     string      `json:"user_id,omitempty"`
	Duration   string      `json:"duration,omitempty"`
	Method     string      `json:"method,omitempty"`
	Path       string      `json:"path,omitempty"`
	StatusCode int         `json:"status_code,omitempty"`
	ClientIP   string      `json:"client_ip,omitempty"`
	UserAgent  string      `json:"user_agent,omitempty"`
	Error      string      `json:"error,omitempty"`
	Context    interface{} `json:"context,omitempty"`
}

// Logger provides structured logging functionality
type Logger struct {
	component string
	level     LogLevel
	output    *log.Logger
	mu        sync.RWMutex
}

// GlobalLogger is the global logger instance
var GlobalLogger *Logger

// InitLogger initializes the global logger
func InitLogger(component string, level LogLevel) {
	GlobalLogger = &Logger{
		component: component,
		level:     level,
		output:    log.New(os.Stdout, "", 0),
	}
}

// NewLogger creates a new logger for a specific component
func NewLogger(component string) *Logger {
	if GlobalLogger == nil {
		InitLogger("aiops", LogLevelInfo)
	}

	return &Logger{
		component: component,
		level:     GlobalLogger.level,
		output:    GlobalLogger.output,
	}
}

// SetLevel sets the logging level
func (l *Logger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// shouldLog determines if a message should be logged based on level
func (l *Logger) shouldLog(level LogLevel) bool {
	levels := map[LogLevel]int{
		LogLevelDebug: 0,
		LogLevelInfo:  1,
		LogLevelWarn:  2,
		LogLevelError: 3,
		LogLevelFatal: 4,
	}

	currentLevel := levels[l.level]
	messageLevel := levels[level]

	return messageLevel >= currentLevel
}

// log writes a structured log entry
func (l *Logger) log(level LogLevel, message string, context interface{}) {
	if !l.shouldLog(level) {
		return
	}

	entry := LogEntry{
		Level:     level,
		Timestamp: time.Now(),
		Message:   message,
		Component: l.component,
		Context:   context,
	}

	// Serialize to JSON
	data, err := json.Marshal(entry)
	if err != nil {
		// Fallback to simple logging if JSON marshaling fails
		l.output.Printf("[%s] %s: %s", level, l.component, message)
		return
	}

	l.output.Println(string(data))
}

// Debug logs a debug message
func (l *Logger) Debug(message string, context ...interface{}) {
	var ctx interface{}
	if len(context) > 0 {
		ctx = context[0]
	}
	l.log(LogLevelDebug, message, ctx)
}

// Info logs an info message
func (l *Logger) Info(message string, context ...interface{}) {
	var ctx interface{}
	if len(context) > 0 {
		ctx = context[0]
	}
	l.log(LogLevelInfo, message, ctx)
}

// Warn logs a warning message
func (l *Logger) Warn(message string, context ...interface{}) {
	var ctx interface{}
	if len(context) > 0 {
		ctx = context[0]
	}
	l.log(LogLevelWarn, message, ctx)
}

// Error logs an error message
func (l *Logger) Error(message string, err error, context ...interface{}) {
	entry := LogEntry{
		Level:     LogLevelError,
		Timestamp: time.Now(),
		Message:   message,
		Component: l.component,
		Error:     err.Error(),
	}

	if len(context) > 0 {
		entry.Context = context[0]
	}

	if l.shouldLog(LogLevelError) {
		data, jsonErr := json.Marshal(entry)
		if jsonErr != nil {
			l.output.Printf("[ERROR] %s: %s - %s", l.component, message, err.Error())
			return
		}
		l.output.Println(string(data))
	}
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(message string, err error, context ...interface{}) {
	entry := LogEntry{
		Level:     LogLevelFatal,
		Timestamp: time.Now(),
		Message:   message,
		Component: l.component,
		Error:     err.Error(),
	}

	if len(context) > 0 {
		entry.Context = context[0]
	}

	data, jsonErr := json.Marshal(entry)
	if jsonErr != nil {
		l.output.Printf("[FATAL] %s: %s - %s", l.component, message, err.Error())
	} else {
		l.output.Println(string(data))
	}

	os.Exit(1)
}

// RequestLogger logs HTTP request details
func (l *Logger) RequestLogger(c *gin.Context, duration time.Duration, statusCode int) {
	entry := LogEntry{
		Level:      LogLevelInfo,
		Timestamp:  time.Now(),
		Message:    "HTTP Request",
		Component:  l.component,
		Duration:   duration.String(),
		Method:     c.Request.Method,
		Path:       c.Request.URL.Path,
		StatusCode: statusCode,
		ClientIP:   c.ClientIP(),
		UserAgent:  c.Request.UserAgent(),
	}

	// Add request ID if available
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		entry.RequestID = requestID
	}

	// Add user ID if available in context
	if userID, exists := c.Get("user_id"); exists {
		if uid, ok := userID.(string); ok {
			entry.UserID = uid
		}
	}

	// Determine log level based on status code
	if statusCode >= 500 {
		entry.Level = LogLevelError
	} else if statusCode >= 400 {
		entry.Level = LogLevelWarn
	}

	if l.shouldLog(entry.Level) {
		data, err := json.Marshal(entry)
		if err != nil {
			l.output.Printf("[%s] %s %s %d %s", entry.Level, entry.Method, entry.Path, statusCode, duration)
			return
		}
		l.output.Println(string(data))
	}
}

// LoggingMiddleware creates a Gin middleware for request logging
func LoggingMiddleware() gin.HandlerFunc {
	logger := NewLogger("http")

	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Skip logging for health check endpoints
		if strings.HasSuffix(path, "/health") || strings.HasSuffix(path, "/readiness") {
			c.Next()
			return
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Log request details
		logger.RequestLogger(c, duration, c.Writer.Status())

		// Log query parameters if present
		if raw != "" {
			logger.Debug("Query parameters", map[string]string{
				"path":  path,
				"query": raw,
			})
		}
	}
}

// PerformanceMetrics tracks API performance metrics
type PerformanceMetrics struct {
	RequestCount    int64         `json:"request_count"`
	ErrorCount      int64         `json:"error_count"`
	AverageResponse time.Duration `json:"average_response_time"`
	MaxResponse     time.Duration `json:"max_response_time"`
	MinResponse     time.Duration `json:"min_response_time"`
	TotalDuration   time.Duration `json:"total_duration"`
	LastReset       time.Time     `json:"last_reset"`
	mu              sync.RWMutex
}

// GlobalMetrics is the global performance metrics instance
var GlobalMetrics = &PerformanceMetrics{
	LastReset:   time.Now(),
	MinResponse: time.Hour, // Initialize to a high value
}

// RecordRequest records a request in performance metrics
func (pm *PerformanceMetrics) RecordRequest(duration time.Duration, isError bool) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.RequestCount++
	pm.TotalDuration += duration

	if isError {
		pm.ErrorCount++
	}

	// Update min/max response times
	if duration > pm.MaxResponse {
		pm.MaxResponse = duration
	}
	if duration < pm.MinResponse {
		pm.MinResponse = duration
	}

	// Calculate average
	if pm.RequestCount > 0 {
		pm.AverageResponse = pm.TotalDuration / time.Duration(pm.RequestCount)
	}
}

// GetMetrics returns current performance metrics
func (pm *PerformanceMetrics) GetMetrics() PerformanceMetrics {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return PerformanceMetrics{
		RequestCount:    pm.RequestCount,
		ErrorCount:      pm.ErrorCount,
		AverageResponse: pm.AverageResponse,
		MaxResponse:     pm.MaxResponse,
		MinResponse:     pm.MinResponse,
		TotalDuration:   pm.TotalDuration,
		LastReset:       pm.LastReset,
	}
}

// Reset resets the performance metrics
func (pm *PerformanceMetrics) Reset() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.RequestCount = 0
	pm.ErrorCount = 0
	pm.AverageResponse = 0
	pm.MaxResponse = 0
	pm.MinResponse = time.Hour
	pm.TotalDuration = 0
	pm.LastReset = time.Now()
}

// MetricsMiddleware tracks performance metrics
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Record metrics
		duration := time.Since(start)
		isError := c.Writer.Status() >= 400

		GlobalMetrics.RecordRequest(duration, isError)
	}
}

// SystemInfo provides system information for monitoring
type SystemInfo struct {
	GoVersion     string    `json:"go_version"`
	NumGoroutines int       `json:"num_goroutines"`
	NumCPU        int       `json:"num_cpu"`
	MemoryUsage   MemStats  `json:"memory_usage"`
	StartTime     time.Time `json:"start_time"`
	Uptime        string    `json:"uptime"`
}

// MemStats provides memory statistics
type MemStats struct {
	Alloc        uint64 `json:"alloc_bytes"`
	TotalAlloc   uint64 `json:"total_alloc_bytes"`
	Sys          uint64 `json:"sys_bytes"`
	NumGC        uint32 `json:"num_gc"`
	PauseTotalNs uint64 `json:"gc_pause_total_ns"`
}

var logStartTime = time.Now()

// GetSystemInfo returns current system information
func GetSystemInfo() SystemInfo {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return SystemInfo{
		GoVersion:     runtime.Version(),
		NumGoroutines: runtime.NumGoroutine(),
		NumCPU:        runtime.NumCPU(),
		MemoryUsage: MemStats{
			Alloc:        m.Alloc,
			TotalAlloc:   m.TotalAlloc,
			Sys:          m.Sys,
			NumGC:        m.NumGC,
			PauseTotalNs: m.PauseTotalNs,
		},
		StartTime: logStartTime,
		Uptime:    time.Since(logStartTime).String(),
	}
}

// LogSystemInfo logs current system information
func LogSystemInfo() {
	logger := NewLogger("system")
	sysInfo := GetSystemInfo()

	logger.Info("System Information", sysInfo)
}
