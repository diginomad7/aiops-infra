package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ErrorCode represents different types of errors
type ErrorCode string

const (
	// Client errors (4xx)
	ErrorCodeValidation   ErrorCode = "VALIDATION_ERROR"
	ErrorCodeNotFound     ErrorCode = "NOT_FOUND"
	ErrorCodeUnauthorized ErrorCode = "UNAUTHORIZED"
	ErrorCodeForbidden    ErrorCode = "FORBIDDEN"
	ErrorCodeConflict     ErrorCode = "CONFLICT"
	ErrorCodeRateLimit    ErrorCode = "RATE_LIMIT"

	// Server errors (5xx)
	ErrorCodeInternal      ErrorCode = "INTERNAL_ERROR"
	ErrorCodeServiceDown   ErrorCode = "SERVICE_UNAVAILABLE"
	ErrorCodeTimeout       ErrorCode = "TIMEOUT"
	ErrorCodeDatabaseError ErrorCode = "DATABASE_ERROR"
	ErrorCodeNetworkError  ErrorCode = "NETWORK_ERROR"

	// Data source errors
	ErrorCodePrometheusDown ErrorCode = "PROMETHEUS_UNAVAILABLE"
	ErrorCodeLokiDown       ErrorCode = "LOKI_UNAVAILABLE"
	ErrorCodeDataSourceAuth ErrorCode = "DATA_SOURCE_AUTH_ERROR"
	ErrorCodeQueryError     ErrorCode = "QUERY_ERROR"

	// Detector errors
	ErrorCodeDetectorNotFound ErrorCode = "DETECTOR_NOT_FOUND"
	ErrorCodeDetectorConflict ErrorCode = "DETECTOR_CONFLICT"
	ErrorCodeDetectorTraining ErrorCode = "DETECTOR_TRAINING_ERROR"
	ErrorCodeDetectorRunning  ErrorCode = "DETECTOR_RUNTIME_ERROR"
)

// APIError represents a structured API error
type APIError struct {
	Code      ErrorCode   `json:"code"`
	Message   string      `json:"message"`
	Details   string      `json:"details,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	RequestID string      `json:"request_id,omitempty"`
	Retryable bool        `json:"retryable"`
	Context   interface{} `json:"context,omitempty"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
}

// ErrorResponse represents the standard error response format
type ErrorResponse struct {
	Error *APIError `json:"error"`
}

// NewAPIError creates a new API error
func NewAPIError(code ErrorCode, message string, details string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
		Retryable: isRetryable(code),
	}
}

// NewValidationError creates a validation error
func NewValidationError(field string, reason string) *APIError {
	return &APIError{
		Code:      ErrorCodeValidation,
		Message:   "Validation failed",
		Details:   fmt.Sprintf("Field '%s': %s", field, reason),
		Timestamp: time.Now(),
		Retryable: false,
	}
}

// NewNotFoundError creates a not found error
func NewNotFoundError(resource string, id string) *APIError {
	return &APIError{
		Code:      ErrorCodeNotFound,
		Message:   fmt.Sprintf("%s not found", resource),
		Details:   fmt.Sprintf("Resource '%s' with ID '%s' does not exist", resource, id),
		Timestamp: time.Now(),
		Retryable: false,
	}
}

// NewInternalError creates an internal server error
func NewInternalError(operation string, err error) *APIError {
	return &APIError{
		Code:      ErrorCodeInternal,
		Message:   "Internal server error",
		Details:   fmt.Sprintf("Operation '%s' failed: %s", operation, err.Error()),
		Timestamp: time.Now(),
		Retryable: true,
	}
}

// NewDataSourceError creates a data source error
func NewDataSourceError(source string, operation string, err error) *APIError {
	var code ErrorCode
	switch source {
	case "prometheus":
		code = ErrorCodePrometheusDown
	case "loki":
		code = ErrorCodeLokiDown
	default:
		code = ErrorCodeNetworkError
	}

	return &APIError{
		Code:      code,
		Message:   fmt.Sprintf("%s unavailable", source),
		Details:   fmt.Sprintf("Failed to %s: %s", operation, err.Error()),
		Timestamp: time.Now(),
		Retryable: true,
		Context:   map[string]string{"source": source, "operation": operation},
	}
}

// NewDetectorError creates a detector-specific error
func NewDetectorError(detectorID string, operation string, err error) *APIError {
	code := ErrorCodeDetectorRunning
	if operation == "create" {
		code = ErrorCodeDetectorConflict
	} else if operation == "training" {
		code = ErrorCodeDetectorTraining
	}

	return &APIError{
		Code:      code,
		Message:   "Detector operation failed",
		Details:   fmt.Sprintf("Detector '%s' %s failed: %s", detectorID, operation, err.Error()),
		Timestamp: time.Now(),
		Retryable: code == ErrorCodeDetectorRunning,
		Context:   map[string]string{"detector_id": detectorID, "operation": operation},
	}
}

// isRetryable determines if an error is retryable
func isRetryable(code ErrorCode) bool {
	retryableCodes := map[ErrorCode]bool{
		ErrorCodeInternal:        true,
		ErrorCodeServiceDown:     true,
		ErrorCodeTimeout:         true,
		ErrorCodeNetworkError:    true,
		ErrorCodePrometheusDown:  true,
		ErrorCodeLokiDown:        true,
		ErrorCodeDetectorRunning: true,
	}
	return retryableCodes[code]
}

// GetHTTPStatusCode returns the appropriate HTTP status code for an error
func (e *APIError) GetHTTPStatusCode() int {
	statusMap := map[ErrorCode]int{
		// 4xx Client Errors
		ErrorCodeValidation:       http.StatusBadRequest,
		ErrorCodeNotFound:         http.StatusNotFound,
		ErrorCodeUnauthorized:     http.StatusUnauthorized,
		ErrorCodeForbidden:        http.StatusForbidden,
		ErrorCodeConflict:         http.StatusConflict,
		ErrorCodeRateLimit:        http.StatusTooManyRequests,
		ErrorCodeDetectorConflict: http.StatusConflict,
		ErrorCodeQueryError:       http.StatusBadRequest,
		ErrorCodeDataSourceAuth:   http.StatusUnauthorized,

		// 5xx Server Errors
		ErrorCodeInternal:         http.StatusInternalServerError,
		ErrorCodeServiceDown:      http.StatusServiceUnavailable,
		ErrorCodeTimeout:          http.StatusGatewayTimeout,
		ErrorCodeDatabaseError:    http.StatusInternalServerError,
		ErrorCodeNetworkError:     http.StatusBadGateway,
		ErrorCodePrometheusDown:   http.StatusServiceUnavailable,
		ErrorCodeLokiDown:         http.StatusServiceUnavailable,
		ErrorCodeDetectorNotFound: http.StatusNotFound,
		ErrorCodeDetectorTraining: http.StatusInternalServerError,
		ErrorCodeDetectorRunning:  http.StatusInternalServerError,
	}

	if status, exists := statusMap[e.Code]; exists {
		return status
	}
	return http.StatusInternalServerError
}

// ErrorHandlerMiddleware provides centralized error handling
func ErrorHandlerMiddleware() gin.HandlerFunc {
	return gin.ErrorLoggerT(gin.ErrorTypeAny)
}

// HandleError responds with a structured error
func HandleError(c *gin.Context, err error) {
	var apiError *APIError

	// Check if it's already an APIError
	if ae, ok := err.(*APIError); ok {
		apiError = ae
	} else {
		// Convert generic error to APIError
		apiError = NewInternalError("unknown", err)
	}

	// Add request ID if available
	if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
		apiError.RequestID = requestID
	}

	// Log the error
	logError(c, apiError)

	// Send structured error response
	c.JSON(apiError.GetHTTPStatusCode(), ErrorResponse{Error: apiError})
	c.Abort()
}

// HandleValidationError responds with a validation error
func HandleValidationError(c *gin.Context, field string, reason string) {
	err := NewValidationError(field, reason)
	HandleError(c, err)
}

// HandleNotFoundError responds with a not found error
func HandleNotFoundError(c *gin.Context, resource string, id string) {
	err := NewNotFoundError(resource, id)
	HandleError(c, err)
}

// HandleInternalError responds with an internal server error
func HandleInternalError(c *gin.Context, operation string, err error) {
	apiError := NewInternalError(operation, err)
	HandleError(c, apiError)
}

// HandleDataSourceError responds with a data source error
func HandleDataSourceError(c *gin.Context, source string, operation string, err error) {
	apiError := NewDataSourceError(source, operation, err)
	HandleError(c, apiError)
}

// HandleDetectorError responds with a detector error
func HandleDetectorError(c *gin.Context, detectorID string, operation string, err error) {
	apiError := NewDetectorError(detectorID, operation, err)
	HandleError(c, apiError)
}

// logError logs the error with appropriate level
func logError(c *gin.Context, err *APIError) {
	requestPath := c.Request.URL.Path
	requestMethod := c.Request.Method
	clientIP := c.ClientIP()

	logMessage := fmt.Sprintf("[%s] %s %s - %s: %s",
		err.Code, requestMethod, requestPath, err.Message, err.Details)

	// Log with different levels based on error severity
	switch err.Code {
	case ErrorCodeValidation, ErrorCodeNotFound, ErrorCodeUnauthorized, ErrorCodeForbidden:
		log.Printf("WARN [%s] %s", clientIP, logMessage)
	case ErrorCodeRateLimit, ErrorCodeConflict:
		log.Printf("INFO [%s] %s", clientIP, logMessage)
	default:
		log.Printf("ERROR [%s] %s", clientIP, logMessage)
	}
}

// HealthCheckError represents a health check failure
type HealthCheckError struct {
	Component string
	Status    string
	Error     string
	LastCheck time.Time
}

// SystemHealthResponse represents overall system health
type SystemHealthResponse struct {
	Status     string             `json:"status"`
	Version    string             `json:"version"`
	Timestamp  time.Time          `json:"timestamp"`
	Uptime     string             `json:"uptime"`
	Components []HealthCheckError `json:"components,omitempty"`
}

// RecoveryMiddleware provides panic recovery with error logging
func RecoveryMiddleware() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		err := fmt.Errorf("panic recovered: %v", recovered)
		apiError := NewInternalError("panic_recovery", err)

		// Log panic with stack trace
		log.Printf("PANIC [%s] %s %s - %v",
			c.ClientIP(), c.Request.Method, c.Request.URL.Path, recovered)

		HandleError(c, apiError)
	})
}
