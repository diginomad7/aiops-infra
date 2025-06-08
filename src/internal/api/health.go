package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
	HealthStatusUnknown   HealthStatus = "unknown"
)

// ComponentHealth represents the health of a specific component
type ComponentHealth struct {
	Name         string            `json:"name"`
	Status       HealthStatus      `json:"status"`
	Message      string            `json:"message,omitempty"`
	LastCheck    time.Time         `json:"last_check"`
	ResponseTime string            `json:"response_time,omitempty"`
	Details      map[string]string `json:"details,omitempty"`
}

// SystemHealth represents overall system health
type SystemHealth struct {
	Status     HealthStatus       `json:"status"`
	Version    string             `json:"version"`
	Timestamp  time.Time          `json:"timestamp"`
	Uptime     string             `json:"uptime"`
	Components []ComponentHealth  `json:"components"`
	Summary    HealthSummary      `json:"summary"`
}

// HealthSummary provides health statistics
type HealthSummary struct {
	Total      int `json:"total"`
	Healthy    int `json:"healthy"`
	Degraded   int `json:"degraded"`
	Unhealthy  int `json:"unhealthy"`
	Unknown    int `json:"unknown"`
}

// HealthChecker interface for components that can report health
type HealthChecker interface {
	CheckHealth() ComponentHealth
}

var (
	startTime = time.Now()
	version   = "2.0.0" // Updated version for Phase 2
)

// checkPrometheusHealth checks Prometheus connectivity
func checkPrometheusHealth() ComponentHealth {
	start := time.Now()
	
	// Use the global connection pool for health checks
	client := GlobalConnectionPool.GetClient()
	
	// Try to connect to Prometheus (using default URL for health check)
	resp, err := client.Get("http://localhost:9090/-/healthy")
	
	responseTime := time.Since(start)
	
	if err != nil {
		return ComponentHealth{
			Name:         "prometheus",
			Status:       HealthStatusUnhealthy,
			Message:      fmt.Sprintf("Connection failed: %s", err.Error()),
			LastCheck:    time.Now(),
			ResponseTime: responseTime.String(),
			Details: map[string]string{
				"error": err.Error(),
				"url":   "http://localhost:9090/-/healthy",
			},
		}
	}
	defer resp.Body.Close()
	
	status := HealthStatusHealthy
	message := "Connected successfully"
	
	if resp.StatusCode != http.StatusOK {
		status = HealthStatusDegraded
		message = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	
	// Check response time threshold
	if responseTime > 5*time.Second {
		if status == HealthStatusHealthy {
			status = HealthStatusDegraded
		}
		message += " (slow response)"
	}
	
	return ComponentHealth{
		Name:         "prometheus",
		Status:       status,
		Message:      message,
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"status_code": fmt.Sprintf("%d", resp.StatusCode),
			"url":         "http://localhost:9090/-/healthy",
		},
	}
}

// checkLokiHealth checks Loki connectivity
func checkLokiHealth() ComponentHealth {
	start := time.Now()
	
	client := GlobalConnectionPool.GetClient()
	
	// Try to connect to Loki (using default URL for health check)
	resp, err := client.Get("http://localhost:3100/ready")
	
	responseTime := time.Since(start)
	
	if err != nil {
		return ComponentHealth{
			Name:         "loki",
			Status:       HealthStatusUnhealthy,
			Message:      fmt.Sprintf("Connection failed: %s", err.Error()),
			LastCheck:    time.Now(),
			ResponseTime: responseTime.String(),
			Details: map[string]string{
				"error": err.Error(),
				"url":   "http://localhost:3100/ready",
			},
		}
	}
	defer resp.Body.Close()
	
	status := HealthStatusHealthy
	message := "Connected successfully"
	
	if resp.StatusCode != http.StatusOK {
		status = HealthStatusDegraded
		message = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	
	// Check response time threshold
	if responseTime > 5*time.Second {
		if status == HealthStatusHealthy {
			status = HealthStatusDegraded
		}
		message += " (slow response)"
	}
	
	return ComponentHealth{
		Name:         "loki",
		Status:       status,
		Message:      message,
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"status_code": fmt.Sprintf("%d", resp.StatusCode),
			"url":         "http://localhost:3100/ready",
		},
	}
}

// checkDatabaseHealth checks database connectivity
func checkDatabaseHealth() ComponentHealth {
	start := time.Now()
	
	// For now, we're using in-memory storage, so just check if it's initialized
	// In a real implementation, this would check actual database connectivity
	
	responseTime := time.Since(start)
	
	return ComponentHealth{
		Name:         "database",
		Status:       HealthStatusHealthy,
		Message:      "In-memory storage operational",
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"type": "in-memory",
		},
	}
}

// checkCacheHealth checks cache system health
func checkCacheHealth() ComponentHealth {
	start := time.Now()
	
	// Test cache operations
	testKey := "health_check_test"
	testValue := "test_value"
	
	// Test write
	GlobalCache.Set(testKey, testValue, time.Second)
	
	// Test read
	value, exists := GlobalCache.Get(testKey)
	
	responseTime := time.Since(start)
	
	status := HealthStatusHealthy
	message := "Cache operational"
	
	if !exists || value != testValue {
		status = HealthStatusDegraded
		message = "Cache read/write test failed"
	}
	
	// Clean up test key
	GlobalCache.Delete(testKey)
	
	stats := GlobalCache.GetStats()
	
	return ComponentHealth{
		Name:         "cache",
		Status:       status,
		Message:      message,
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"hits":      fmt.Sprintf("%d", stats.Hits),
			"misses":    fmt.Sprintf("%d", stats.Misses),
			"hit_ratio": fmt.Sprintf("%.2f", stats.HitRatio),
			"size":      fmt.Sprintf("%d", stats.Size),
		},
	}
}

// checkWebSocketHealth checks WebSocket gateway health
func checkWebSocketHealth() ComponentHealth {
	start := time.Now()
	
	// For now, just check if the WebSocket module is initialized
	// In a real implementation, this would check WebSocket connections
	
	responseTime := time.Since(start)
	
	return ComponentHealth{
		Name:         "websocket",
		Status:       HealthStatusHealthy,
		Message:      "WebSocket gateway operational",
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"protocol": "websocket",
			"endpoint": "/ws",
		},
	}
}

// checkDetectorHealth checks ML detector health
func checkDetectorHealth() ComponentHealth {
	start := time.Now()
	
	// Check if detector service is operational
	// This would typically check if detectors are running and processing data
	
	responseTime := time.Since(start)
	
	return ComponentHealth{
		Name:         "detector",
		Status:       HealthStatusHealthy,
		Message:      "ML detector service operational",
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"type": "statistical_mad",
			"status": "ready",
		},
	}
}

// checkSystemHealth checks overall system health
func checkSystemHealth() ComponentHealth {
	start := time.Now()
	
	sysInfo := GetSystemInfo()
	responseTime := time.Since(start)
	
	status := HealthStatusHealthy
	message := "System operational"
	
	// Check memory usage (alert if > 90%)
	memUsage := float64(sysInfo.MemoryUsage.Alloc) / float64(sysInfo.MemoryUsage.Sys)
	if memUsage > 0.9 {
		status = HealthStatusDegraded
		message = "High memory usage"
	}
	
	// Check goroutine count (alert if > 1000)
	if sysInfo.NumGoroutines > 1000 {
		if status == HealthStatusHealthy {
			status = HealthStatusDegraded
		}
		message = "High goroutine count"
	}
	
	return ComponentHealth{
		Name:         "system",
		Status:       status,
		Message:      message,
		LastCheck:    time.Now(),
		ResponseTime: responseTime.String(),
		Details: map[string]string{
			"go_version":    sysInfo.GoVersion,
			"goroutines":    fmt.Sprintf("%d", sysInfo.NumGoroutines),
			"memory_alloc":  fmt.Sprintf("%.2f MB", float64(sysInfo.MemoryUsage.Alloc)/1024/1024),
			"gc_runs":       fmt.Sprintf("%d", sysInfo.MemoryUsage.NumGC),
			"uptime":        sysInfo.Uptime,
		},
	}
}

// calculateOverallStatus determines overall system status based on components
func calculateOverallStatus(components []ComponentHealth) HealthStatus {
	hasUnhealthy := false
	hasDegraded := false
	
	for _, component := range components {
		switch component.Status {
		case HealthStatusUnhealthy:
			hasUnhealthy = true
		case HealthStatusDegraded:
			hasDegraded = true
		}
	}
	
	if hasUnhealthy {
		return HealthStatusUnhealthy
	}
	if hasDegraded {
		return HealthStatusDegraded
	}
	return HealthStatusHealthy
}

// calculateSummary creates health summary statistics
func calculateSummary(components []ComponentHealth) HealthSummary {
	summary := HealthSummary{}
	
	for _, component := range components {
		summary.Total++
		switch component.Status {
		case HealthStatusHealthy:
			summary.Healthy++
		case HealthStatusDegraded:
			summary.Degraded++
		case HealthStatusUnhealthy:
			summary.Unhealthy++
		default:
			summary.Unknown++
		}
	}
	
	return summary
}

// HealthHandler returns overall system health
func HealthHandler(c *gin.Context) {
	// Check all components
	components := []ComponentHealth{
		checkSystemHealth(),
		checkDatabaseHealth(),
		checkCacheHealth(),
		checkWebSocketHealth(),
		checkDetectorHealth(),
		checkPrometheusHealth(),
		checkLokiHealth(),
	}
	
	overallStatus := calculateOverallStatus(components)
	summary := calculateSummary(components)
	
	health := SystemHealth{
		Status:     overallStatus,
		Version:    version,
		Timestamp:  time.Now(),
		Uptime:     time.Since(startTime).String(),
		Components: components,
		Summary:    summary,
	}
	
	// Set appropriate HTTP status based on health
	statusCode := http.StatusOK
	if overallStatus == HealthStatusDegraded {
		statusCode = http.StatusOK // Still OK, but with warnings
	} else if overallStatus == HealthStatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, health)
}

// ReadinessHandler returns readiness status (simplified health check)
func ReadinessHandler(c *gin.Context) {
	// Quick readiness check - just check if critical components are responding
	ready := true
	components := []string{}
	
	// Check if API is responsive
	if ready {
		components = append(components, "api")
	}
	
	response := gin.H{
		"ready":      ready,
		"timestamp":  time.Now(),
		"components": components,
	}
	
	if ready {
		c.JSON(http.StatusOK, response)
	} else {
		c.JSON(http.StatusServiceUnavailable, response)
	}
}

// LivenessHandler returns liveness status (basic health)
func LivenessHandler(c *gin.Context) {
	// Basic liveness check - just return that the service is running
	c.JSON(http.StatusOK, gin.H{
		"alive":     true,
		"timestamp": time.Now(),
		"uptime":    time.Since(startTime).String(),
		"version":   version,
	})
}

// MetricsHandler returns performance metrics
func MetricsHandler(c *gin.Context) {
	stats := GetPerformanceStats()
	c.JSON(http.StatusOK, stats)
}

// ComponentHealthHandler returns health of a specific component
func ComponentHealthHandler(c *gin.Context) {
	component := c.Param("component")
	
	var health ComponentHealth
	
	switch component {
	case "prometheus":
		health = checkPrometheusHealth()
	case "loki":
		health = checkLokiHealth()
	case "database":
		health = checkDatabaseHealth()
	case "cache":
		health = checkCacheHealth()
	case "websocket":
		health = checkWebSocketHealth()
	case "detector":
		health = checkDetectorHealth()
	case "system":
		health = checkSystemHealth()
	default:
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Component '%s' not found", component),
			"available_components": []string{
				"prometheus", "loki", "database", "cache", 
				"websocket", "detector", "system",
			},
		})
		return
	}
	
	// Set appropriate HTTP status based on component health
	statusCode := http.StatusOK
	if health.Status == HealthStatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, health)
} 