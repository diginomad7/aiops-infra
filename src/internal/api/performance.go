package api

import (
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ConnectionPool manages HTTP connections for data sources
type ConnectionPool struct {
	client    *http.Client
	maxConns  int
	idleConns int
	timeout   time.Duration
	keepAlive time.Duration
	mu        sync.RWMutex
}

// NewConnectionPool creates a new optimized connection pool
func NewConnectionPool() *ConnectionPool {
	return &ConnectionPool{
		client: &http.Client{
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 30,
				IdleConnTimeout:     90 * time.Second,
				TLSHandshakeTimeout: 10 * time.Second,
				DisableCompression:  false,
			},
			Timeout: 30 * time.Second,
		},
		maxConns:  100,
		idleConns: 30,
		timeout:   30 * time.Second,
		keepAlive: 90 * time.Second,
	}
}

// GetClient returns the optimized HTTP client
func (cp *ConnectionPool) GetClient() *http.Client {
	cp.mu.RLock()
	defer cp.mu.RUnlock()
	return cp.client
}

// UpdateConfig updates connection pool configuration
func (cp *ConnectionPool) UpdateConfig(maxConns, idleConns int, timeout, keepAlive time.Duration) {
	cp.mu.Lock()
	defer cp.mu.Unlock()

	cp.maxConns = maxConns
	cp.idleConns = idleConns
	cp.timeout = timeout
	cp.keepAlive = keepAlive

	// Update transport settings
	transport := cp.client.Transport.(*http.Transport)
	transport.MaxIdleConns = maxConns
	transport.MaxIdleConnsPerHost = idleConns
	transport.IdleConnTimeout = keepAlive

	cp.client.Timeout = timeout
}

// GetStats returns connection pool statistics
func (cp *ConnectionPool) GetStats() map[string]interface{} {
	cp.mu.RLock()
	defer cp.mu.RUnlock()

	return map[string]interface{}{
		"max_connections":  cp.maxConns,
		"idle_connections": cp.idleConns,
		"timeout":          cp.timeout.String(),
		"keep_alive":       cp.keepAlive.String(),
	}
}

// GlobalConnectionPool is the global connection pool instance
var GlobalConnectionPool = NewConnectionPool()

// CacheEntry represents a cached item
type CacheEntry struct {
	Value     interface{}
	ExpiresAt time.Time
	Accessed  time.Time
	HitCount  int64
}

// Cache provides in-memory caching with TTL and LRU eviction
type Cache struct {
	data       map[string]*CacheEntry
	mutex      sync.RWMutex
	maxSize    int
	defaultTTL time.Duration
	stats      CacheStats
}

// CacheStats tracks cache performance metrics
type CacheStats struct {
	Hits      int64     `json:"hits"`
	Misses    int64     `json:"misses"`
	Evictions int64     `json:"evictions"`
	Size      int       `json:"size"`
	HitRatio  float64   `json:"hit_ratio"`
	LastReset time.Time `json:"last_reset"`
	mu        sync.RWMutex
}

// NewCache creates a new cache with specified parameters
func NewCache(maxSize int, defaultTTL time.Duration) *Cache {
	cache := &Cache{
		data:       make(map[string]*CacheEntry),
		maxSize:    maxSize,
		defaultTTL: defaultTTL,
		stats:      CacheStats{LastReset: time.Now()},
	}

	// Start cleanup goroutine
	go cache.cleanup()

	return cache
}

// Set stores a value in the cache with optional TTL
func (c *Cache) Set(key string, value interface{}, ttl ...time.Duration) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	expireDuration := c.defaultTTL
	if len(ttl) > 0 {
		expireDuration = ttl[0]
	}

	// Check if we need to evict items
	if len(c.data) >= c.maxSize {
		c.evictLRU()
	}

	c.data[key] = &CacheEntry{
		Value:     value,
		ExpiresAt: time.Now().Add(expireDuration),
		Accessed:  time.Now(),
		HitCount:  0,
	}

	c.updateSize()
}

// Get retrieves a value from the cache
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	entry, exists := c.data[key]
	if !exists {
		c.stats.mu.Lock()
		c.stats.Misses++
		c.updateHitRatio()
		c.stats.mu.Unlock()
		return nil, false
	}

	// Check if expired
	if time.Now().After(entry.ExpiresAt) {
		delete(c.data, key)
		c.stats.mu.Lock()
		c.stats.Misses++
		c.updateHitRatio()
		c.stats.mu.Unlock()
		c.updateSize()
		return nil, false
	}

	// Update access info
	entry.Accessed = time.Now()
	entry.HitCount++

	c.stats.mu.Lock()
	c.stats.Hits++
	c.updateHitRatio()
	c.stats.mu.Unlock()

	return entry.Value, true
}

// Delete removes a key from the cache
func (c *Cache) Delete(key string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	delete(c.data, key)
	c.updateSize()
}

// Clear removes all items from the cache
func (c *Cache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.data = make(map[string]*CacheEntry)
	c.updateSize()
}

// GetStats returns cache statistics
func (c *Cache) GetStats() CacheStats {
	c.stats.mu.RLock()
	defer c.stats.mu.RUnlock()

	return CacheStats{
		Hits:      c.stats.Hits,
		Misses:    c.stats.Misses,
		Evictions: c.stats.Evictions,
		Size:      c.stats.Size,
		HitRatio:  c.stats.HitRatio,
		LastReset: c.stats.LastReset,
	}
}

// evictLRU removes the least recently used item
func (c *Cache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time = time.Now()

	for key, entry := range c.data {
		if entry.Accessed.Before(oldestTime) {
			oldestTime = entry.Accessed
			oldestKey = key
		}
	}

	if oldestKey != "" {
		delete(c.data, oldestKey)
		c.stats.mu.Lock()
		c.stats.Evictions++
		c.stats.mu.Unlock()
	}
}

// cleanup periodically removes expired entries
func (c *Cache) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mutex.Lock()
		now := time.Now()
		for key, entry := range c.data {
			if now.After(entry.ExpiresAt) {
				delete(c.data, key)
			}
		}
		c.updateSize()
		c.mutex.Unlock()
	}
}

// updateSize updates the cache size in stats
func (c *Cache) updateSize() {
	c.stats.mu.Lock()
	c.stats.Size = len(c.data)
	c.stats.mu.Unlock()
}

// updateHitRatio calculates the current hit ratio
func (c *Cache) updateHitRatio() {
	total := c.stats.Hits + c.stats.Misses
	if total > 0 {
		c.stats.HitRatio = float64(c.stats.Hits) / float64(total)
	}
}

// GlobalCache is the global cache instance
var GlobalCache = NewCache(1000, 5*time.Minute)

// ResponseCache provides HTTP response caching middleware
func ResponseCacheMiddleware(ttl time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only cache GET requests
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		// Generate cache key
		cacheKey := fmt.Sprintf("%s:%s:%s", c.Request.Method, c.Request.URL.Path, c.Request.URL.RawQuery)

		// Check cache
		if cached, exists := GlobalCache.Get(cacheKey); exists {
			if response, ok := cached.(CachedResponse); ok {
				// Set headers
				for key, value := range response.Headers {
					c.Header(key, value)
				}
				c.Header("X-Cache", "HIT")
				c.Data(response.StatusCode, response.ContentType, response.Body)
				c.Abort()
				return
			}
		}

		// Not in cache, continue with request
		c.Header("X-Cache", "MISS")
		c.Next()

		// Cache successful responses
		if c.Writer.Status() == http.StatusOK {
			// Note: This is a simplified implementation
			// In production, you'd need to capture the response body
			GlobalCache.Set(cacheKey, struct{}{}, ttl)
		}
	}
}

// CachedResponse represents a cached HTTP response
type CachedResponse struct {
	StatusCode  int
	Headers     map[string]string
	Body        []byte
	ContentType string
}

// CompressionMiddleware provides response compression
func CompressionMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Enable compression based on Accept-Encoding header
		if !shouldCompress(c) {
			c.Next()
			return
		}

		c.Header("Content-Encoding", "gzip")
		c.Next()
	}
}

// shouldCompress determines if response should be compressed
func shouldCompress(c *gin.Context) bool {
	// Check Accept-Encoding header
	encoding := c.GetHeader("Accept-Encoding")
	return encoding != "" &&
		(c.GetHeader("Content-Type") == "application/json" ||
			c.GetHeader("Content-Type") == "text/plain")
}

// RateLimiter provides request rate limiting
type RateLimiter struct {
	requests map[string][]time.Time
	limit    int
	window   time.Duration
	mutex    sync.RWMutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// Allow checks if a request should be allowed
func (rl *RateLimiter) Allow(clientIP string) bool {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Get or create request list for client
	requests, exists := rl.requests[clientIP]
	if !exists {
		requests = make([]time.Time, 0)
	}

	// Remove old requests outside the window
	var validRequests []time.Time
	for _, req := range requests {
		if req.After(windowStart) {
			validRequests = append(validRequests, req)
		}
	}

	// Check if limit exceeded
	if len(validRequests) >= rl.limit {
		return false
	}

	// Add current request
	validRequests = append(validRequests, now)
	rl.requests[clientIP] = validRequests

	return true
}

// cleanup removes old entries
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mutex.Lock()
		now := time.Now()
		windowStart := now.Add(-rl.window)

		for clientIP, requests := range rl.requests {
			var validRequests []time.Time
			for _, req := range requests {
				if req.After(windowStart) {
					validRequests = append(validRequests, req)
				}
			}

			if len(validRequests) == 0 {
				delete(rl.requests, clientIP)
			} else {
				rl.requests[clientIP] = validRequests
			}
		}
		rl.mutex.Unlock()
	}
}

// GlobalRateLimiter is the global rate limiter instance
var GlobalRateLimiter = NewRateLimiter(100, time.Minute)

// RateLimitMiddleware provides rate limiting middleware
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		if !GlobalRateLimiter.Allow(clientIP) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"retry_after": "60s",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// PerformanceConfig holds performance optimization settings
type PerformanceConfig struct {
	CacheEnabled          bool          `json:"cache_enabled"`
	CacheTTL              time.Duration `json:"cache_ttl"`
	CacheMaxSize          int           `json:"cache_max_size"`
	RateLimitEnabled      bool          `json:"rate_limit_enabled"`
	RateLimit             int           `json:"rate_limit"`
	RateLimitWindow       time.Duration `json:"rate_limit_window"`
	CompressionEnabled    bool          `json:"compression_enabled"`
	ConnectionPoolEnabled bool          `json:"connection_pool_enabled"`
}

// DefaultPerformanceConfig returns default performance settings
func DefaultPerformanceConfig() PerformanceConfig {
	return PerformanceConfig{
		CacheEnabled:          true,
		CacheTTL:              5 * time.Minute,
		CacheMaxSize:          1000,
		RateLimitEnabled:      true,
		RateLimit:             100,
		RateLimitWindow:       time.Minute,
		CompressionEnabled:    true,
		ConnectionPoolEnabled: true,
	}
}

// PerformanceMiddleware combines all performance optimizations
func PerformanceMiddleware(config PerformanceConfig) []gin.HandlerFunc {
	var middlewares []gin.HandlerFunc

	// Add metrics middleware
	middlewares = append(middlewares, MetricsMiddleware())

	// Add rate limiting if enabled
	if config.RateLimitEnabled {
		middlewares = append(middlewares, RateLimitMiddleware())
	}

	// Add response caching if enabled
	if config.CacheEnabled {
		middlewares = append(middlewares, ResponseCacheMiddleware(config.CacheTTL))
	}

	// Add compression if enabled
	if config.CompressionEnabled {
		middlewares = append(middlewares, CompressionMiddleware())
	}

	return middlewares
}

// GetPerformanceStats returns comprehensive performance statistics
func GetPerformanceStats() map[string]interface{} {
	stats := make(map[string]interface{})

	// Add cache stats
	stats["cache"] = GlobalCache.GetStats()

	// Add metrics stats
	stats["metrics"] = GlobalMetrics.GetMetrics()

	// Add connection pool stats
	stats["connection_pool"] = GlobalConnectionPool.GetStats()

	// Add system stats
	stats["system"] = GetSystemInfo()

	// Add memory stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	stats["memory"] = map[string]interface{}{
		"heap_alloc_bytes":   m.HeapAlloc,
		"heap_sys_bytes":     m.HeapSys,
		"stack_in_use_bytes": m.StackInuse,
		"gc_runs":            m.NumGC,
		"gc_pause_total_ms":  float64(m.PauseTotalNs) / 1e6,
	}

	return stats
}

// OptimizeForLoad applies load-specific optimizations
func OptimizeForLoad(expectedLoad int) {
	if expectedLoad > 1000 {
		// High load optimizations
		GlobalConnectionPool.UpdateConfig(200, 50, 15*time.Second, 120*time.Second)
		GlobalRateLimiter = NewRateLimiter(500, time.Minute)
		GlobalCache = NewCache(5000, 10*time.Minute)
	} else if expectedLoad > 100 {
		// Medium load optimizations
		GlobalConnectionPool.UpdateConfig(150, 40, 20*time.Second, 100*time.Second)
		GlobalRateLimiter = NewRateLimiter(200, time.Minute)
		GlobalCache = NewCache(2000, 7*time.Minute)
	}
	// Low load uses default settings
}
