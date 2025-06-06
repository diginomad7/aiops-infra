package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/aiops-infra/src/internal/detector"
	"github.com/yourusername/aiops-infra/src/internal/orchestrator"
)

// Server представляет сервер API
type Server struct {
	orchestrator *orchestrator.Orchestrator
	engine       *gin.Engine
	promDetector *detector.PrometheusAnomalyDetector
	logsDetector *detector.LogsAnomalyDetector
	detectors    map[string]interface{} // Для хранения различных детекторов

	// New: Detector Management Service
	detectorManager *DetectorManager

	// New: WebSocket Gateway for real-time updates
	wsGateway *WebSocketGateway
}

// DetectorManager manages detector lifecycle and operations
type DetectorManager struct {
	detectors map[string]*DetectorInstance
	nextID    int
	mu        sync.RWMutex
}

// DetectorInstance represents a configured detector instance
type DetectorInstance struct {
	ID        string                  `json:"id"`
	Name      string                  `json:"name"`
	Type      detector.DetectorType   `json:"type"`
	Status    string                  `json:"status"`
	Config    detector.DetectorConfig `json:"config"`
	Detector  detector.Detector       `json:"-"`
	CreatedAt time.Time               `json:"created_at"`
	UpdatedAt time.Time               `json:"updated_at"`
	Metrics   DetectorMetrics         `json:"metrics"`
}

// DetectorMetrics contains runtime metrics for a detector
type DetectorMetrics struct {
	TotalDetections int64      `json:"total_detections"`
	AnomaliesFound  int64      `json:"anomalies_found"`
	AnomalyRate     float64    `json:"anomaly_rate"`
	LastDetection   *time.Time `json:"last_detection,omitempty"`
	AvgResponseTime float64    `json:"avg_response_time_ms"`
}

// DetectorRequest represents a request to create/update a detector
type DetectorRequest struct {
	Name        string                  `json:"name" binding:"required"`
	Type        detector.DetectorType   `json:"type" binding:"required"`
	Config      detector.DetectorConfig `json:"config" binding:"required"`
	Description string                  `json:"description,omitempty"`
}

// DetectorResponse represents a detector in API responses
type DetectorResponse struct {
	*DetectorInstance
	Health map[string]interface{} `json:"health,omitempty"`
}

// NewServer создает новый сервер API
func NewServer(orch *orchestrator.Orchestrator) *Server {
	router := gin.Default()
	wsGateway := NewWebSocketGateway()

	server := &Server{
		orchestrator: orch,
		engine:       router,
		detectors:    make(map[string]interface{}),
		detectorManager: &DetectorManager{
			detectors: make(map[string]*DetectorInstance),
			nextID:    1,
		},
		wsGateway: wsGateway,
	}

	// Настройка маршрутов API
	server.setupRoutes()

	return server
}

// RegisterPrometheusDetector регистрирует детектор Prometheus в API
func (s *Server) RegisterPrometheusDetector(detector *detector.PrometheusAnomalyDetector) {
	s.promDetector = detector
	s.detectors["prometheus"] = detector
	// Добавляем маршруты для Prometheus API
	s.setupPrometheusRoutes()
}

// RegisterLogsDetector регистрирует детектор логов в API
func (s *Server) RegisterLogsDetector(detector *detector.LogsAnomalyDetector) {
	s.logsDetector = detector
	s.detectors["logs"] = detector
	// Добавляем маршруты для Loki API
	s.setupLokiRoutes()
}

// setupRoutes настраивает маршруты API
func (s *Server) setupRoutes() {
	// Маршруты для оркестратора
	s.engine.POST("/api/orchestrator/action", s.handleExecuteAction)
	s.engine.POST("/api/orchestrator/actionplan", s.handleExecuteActionPlan)
	s.engine.GET("/api/orchestrator/action/:id", s.handleGetAction)
	s.engine.GET("/api/orchestrator/actions", s.handleListActions)

	// NEW: Detector Management Routes
	s.setupDetectorRoutes()

	// NEW: WebSocket Route
	s.engine.GET("/api/ws", s.wsGateway.HandleWebSocket)

	// Маршрут для проверки работоспособности
	s.engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Маршрут для проверки готовности
	s.engine.GET("/readiness", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
}

// setupPrometheusRoutes настраивает маршруты API для Prometheus
func (s *Server) setupPrometheusRoutes() {
	if s.promDetector == nil {
		return
	}

	promGroup := s.engine.Group("/api/prometheus")
	{
		// Выполнение разовой проверки на аномалии
		promGroup.POST("/check", s.handlePrometheusCheck)

		// Анализ исторических данных
		promGroup.POST("/analyze", s.handlePrometheusAnalyze)
	}
}

// setupLokiRoutes настраивает маршруты API для Loki
func (s *Server) setupLokiRoutes() {
	if s.logsDetector == nil {
		return
	}

	lokiGroup := s.engine.Group("/api/logs")
	{
		// Получение списка аномалий в логах
		lokiGroup.GET("/anomalies", s.handleGetLogAnomalies)

		// Добавление нового шаблона
		lokiGroup.POST("/patterns", s.handleAddLogPattern)

		// Выполнение разового запроса к Loki
		lokiGroup.GET("/query", s.handleQueryLoki)

		// Получение информации о детекторе логов
		lokiGroup.GET("/detector", s.handleGetLogDetectorInfo)
	}
}

// setupDetectorRoutes configures detector management API routes
func (s *Server) setupDetectorRoutes() {
	detectorsGroup := s.engine.Group("/api/detectors")
	{
		// CRUD Operations
		detectorsGroup.POST("", s.handleCreateDetector)       // Create detector
		detectorsGroup.GET("", s.handleListDetectors)         // List detectors with pagination
		detectorsGroup.GET("/:id", s.handleGetDetector)       // Get specific detector
		detectorsGroup.PUT("/:id", s.handleUpdateDetector)    // Update detector configuration
		detectorsGroup.DELETE("/:id", s.handleDeleteDetector) // Delete detector

		// Detector Operations
		detectorsGroup.POST("/:id/start", s.handleStartDetector)     // Start detector
		detectorsGroup.POST("/:id/stop", s.handleStopDetector)       // Stop detector
		detectorsGroup.GET("/:id/status", s.handleGetDetectorStatus) // Get real-time status
		detectorsGroup.GET("/:id/health", s.handleGetDetectorHealth) // Get health metrics

		// Detection Operations
		detectorsGroup.POST("/:id/detect", s.handleRunDetection) // Run single detection
		detectorsGroup.POST("/:id/train", s.handleTrainDetector) // Train detector
	}
}

// Start запускает сервер API
func (s *Server) Start(addr string) error {
	// Start WebSocket gateway
	ctx := context.Background()
	s.wsGateway.Start(ctx)

	return s.engine.Run(addr)
}

// Stop останавливает сервер API
func (s *Server) Stop(ctx context.Context) error {
	// В реальном сценарии здесь бы использовали graceful shutdown
	return nil
}

// handleExecuteAction обрабатывает запрос на выполнение одного действия
func (s *Server) handleExecuteAction(c *gin.Context) {
	var action orchestrator.Action
	if err := c.ShouldBindJSON(&action); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := s.orchestrator.ExecuteAction(c.Request.Context(), action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// handleExecuteActionPlan обрабатывает запрос на выполнение плана действий
func (s *Server) handleExecuteActionPlan(c *gin.Context) {
	var plan []orchestrator.Action
	if err := c.ShouldBindJSON(&plan); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := s.orchestrator.ExecuteActionPlan(c.Request.Context(), plan)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// handleGetAction обрабатывает запрос на получение информации о действии
func (s *Server) handleGetAction(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}

	action, found := s.orchestrator.GetAction(id)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "action not found"})
		return
	}

	c.JSON(http.StatusOK, action)
}

// handleListActions обрабатывает запрос на получение списка действий
func (s *Server) handleListActions(c *gin.Context) {
	actions := s.orchestrator.ListActions()
	c.JSON(http.StatusOK, actions)
}

// PrometheusCheckRequest представляет запрос на проверку аномалий Prometheus
type PrometheusCheckRequest struct {
	Query        string  `json:"query"`
	DetectorType string  `json:"detector_type"`
	Threshold    float64 `json:"threshold"`
	WindowSize   int     `json:"window_size,omitempty"`
	NumTrees     int     `json:"num_trees,omitempty"`
	SampleSize   int     `json:"sample_size,omitempty"`
}

// handlePrometheusCheck обрабатывает запрос на проверку аномалий Prometheus
func (s *Server) handlePrometheusCheck(c *gin.Context) {
	if s.promDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prometheus detector not available"})
		return
	}

	var req PrometheusCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Настраиваем конфигурацию детектора
	var detectorConfig detector.DetectorConfig
	detectorConfig.DataType = "adhoc"
	detectorConfig.Threshold = req.Threshold

	// Определяем тип детектора
	switch req.DetectorType {
	case "statistical":
		detectorConfig.Type = detector.TypeStatistical
	case "window":
		detectorConfig.Type = detector.TypeWindow
		detectorConfig.WindowSize = req.WindowSize
	case "isolation_forest":
		detectorConfig.Type = detector.TypeIsolationForest
		detectorConfig.NumTrees = req.NumTrees
		detectorConfig.SampleSize = req.SampleSize
	default:
		detectorConfig.Type = detector.TypeStatistical
	}

	// Выполняем проверку
	anomalies, err := s.promDetector.RunAdHocCheck(c.Request.Context(), req.Query, detectorConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":     req.Query,
		"anomalies": anomalies,
		"count":     len(anomalies),
	})
}

// PrometheusAnalyzeRequest представляет запрос на анализ исторических данных Prometheus
type PrometheusAnalyzeRequest struct {
	Query        string    `json:"query"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	Step         string    `json:"step"`
	DetectorType string    `json:"detector_type"`
	Threshold    float64   `json:"threshold"`
	WindowSize   int       `json:"window_size,omitempty"`
	NumTrees     int       `json:"num_trees,omitempty"`
	SampleSize   int       `json:"sample_size,omitempty"`
}

// handlePrometheusAnalyze обрабатывает запрос на анализ исторических данных Prometheus
func (s *Server) handlePrometheusAnalyze(c *gin.Context) {
	if s.promDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prometheus detector not available"})
		return
	}

	var req PrometheusAnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Настраиваем конфигурацию детектора
	var detectorConfig detector.DetectorConfig
	detectorConfig.DataType = "historic"
	detectorConfig.Threshold = req.Threshold

	// Определяем тип детектора
	switch req.DetectorType {
	case "statistical":
		detectorConfig.Type = detector.TypeStatistical
	case "window":
		detectorConfig.Type = detector.TypeWindow
		detectorConfig.WindowSize = req.WindowSize
	case "isolation_forest":
		detectorConfig.Type = detector.TypeIsolationForest
		detectorConfig.NumTrees = req.NumTrees
		detectorConfig.SampleSize = req.SampleSize
	default:
		detectorConfig.Type = detector.TypeStatistical
	}

	// Преобразуем строку шага в длительность
	step, err := time.ParseDuration(req.Step)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid step: %s", err)})
		return
	}

	// Выполняем анализ
	anomalies, err := s.promDetector.AnalyzeHistoricalData(
		c.Request.Context(),
		req.Query,
		detectorConfig,
		req.Start,
		req.End,
		step,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"query":     req.Query,
		"start":     req.Start,
		"end":       req.End,
		"step":      req.Step,
		"anomalies": anomalies,
		"count":     len(anomalies),
	})
}

// LokiPatternRequest представляет запрос на добавление шаблона для обнаружения аномалий
type LokiPatternRequest struct {
	Pattern     string   `json:"pattern"`
	Severity    string   `json:"severity"`
	Description string   `json:"description"`
	Labels      []string `json:"labels"`
}

// handleGetLogAnomalies возвращает список обнаруженных аномалий в логах
func (s *Server) handleGetLogAnomalies(c *gin.Context) {
	if s.logsDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Logs detector not available"})
		return
	}

	// Здесь должна быть логика получения списка аномалий из детектора
	// В текущей реализации это заглушка
	anomalies := []detector.Anomaly{} // Получаем из детектора

	// Отправляем ответ
	c.JSON(http.StatusOK, gin.H{
		"anomalies": anomalies,
		"count":     len(anomalies),
	})
}

// handleAddLogPattern добавляет новый шаблон для обнаружения аномалий в логах
func (s *Server) handleAddLogPattern(c *gin.Context) {
	if s.logsDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Logs detector not available"})
		return
	}

	// Парсим запрос
	var patternReq LokiPatternRequest
	if err := c.ShouldBindJSON(&patternReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Ошибка парсинга запроса: %v", err)})
		return
	}

	// Валидируем запрос
	if patternReq.Pattern == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Шаблон не может быть пустым"})
		return
	}

	if patternReq.Severity == "" {
		patternReq.Severity = "medium" // Значение по умолчанию
	}

	// Добавляем шаблон
	err := s.logsDetector.AddPattern(patternReq.Pattern, patternReq.Severity, patternReq.Description, patternReq.Labels)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка добавления шаблона: %v", err)})
		return
	}

	// Отправляем успешный ответ
	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Шаблон успешно добавлен",
		"pattern": patternReq,
	})
}

// handleQueryLoki выполняет разовый запрос к Loki
func (s *Server) handleQueryLoki(c *gin.Context) {
	if s.logsDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Logs detector not available"})
		return
	}

	// Получаем параметры запроса
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Параметр запроса 'query' обязателен"})
		return
	}

	// Получаем временные рамки (опционально)
	startStr := c.Query("start")
	endStr := c.Query("end")

	var start, end time.Time
	var err error

	// Если не указано начало, используем значение по умолчанию (1 час назад)
	if startStr == "" {
		start = time.Now().Add(-1 * time.Hour)
	} else {
		startUnix, err := strconv.ParseInt(startStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Неверный формат временной метки 'start': %v", err)})
			return
		}
		start = time.Unix(startUnix, 0)
	}

	// Если не указан конец, используем текущее время
	if endStr == "" {
		end = time.Now()
	} else {
		endUnix, err := strconv.ParseInt(endStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Неверный формат временной метки 'end': %v", err)})
			return
		}
		end = time.Unix(endUnix, 0)
	}

	// Выполняем запрос к Loki
	streams, err := s.logsDetector.QueryLoki(c.Request.Context(), query, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка выполнения запроса к Loki: %v", err)})
		return
	}

	// Отправляем ответ
	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"query":       query,
		"start":       start.Format(time.RFC3339),
		"end":         end.Format(time.RFC3339),
		"streamCount": len(streams),
		"streams":     streams,
	})
}

// handleGetLogDetectorInfo возвращает информацию о детекторе логов
func (s *Server) handleGetLogDetectorInfo(c *gin.Context) {
	if s.logsDetector == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Logs detector not available"})
		return
	}

	// Собираем информацию о детекторе
	info := gin.H{
		"type":             s.logsDetector.Type(),
		"name":             s.logsDetector.Name(),
		"errorThreshold":   s.logsDetector.GetErrorThreshold(),
		"warningThreshold": s.logsDetector.GetWarningThreshold(),
		"timeWindow":       s.logsDetector.GetTimeWindow().String(),
		"patternCount":     s.logsDetector.GetPatternCount(),
	}

	// Отправляем ответ
	c.JSON(http.StatusOK, info)
}

// handleCreateDetector creates a new detector instance
func (s *Server) handleCreateDetector(c *gin.Context) {
	var req DetectorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create detector instance
	detectorInstance, err := s.createDetectorInstance(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Store in manager
	s.detectorManager.mu.Lock()
	s.detectorManager.detectors[detectorInstance.ID] = detectorInstance
	s.detectorManager.mu.Unlock()

	// Send WebSocket event
	s.wsGateway.SendEvent(Event{
		Type:      EventDetectorCreated,
		Topic:     TopicDetectors,
		Data:      detectorInstance,
		Timestamp: time.Now(),
	})

	// Return created detector
	response := &DetectorResponse{DetectorInstance: detectorInstance}
	c.JSON(http.StatusCreated, response)
}

// handleListDetectors returns a paginated list of detectors
func (s *Server) handleListDetectors(c *gin.Context) {
	// Parse pagination parameters
	page := 1
	limit := 10

	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	// Filter parameters
	detectorType := c.Query("type")
	status := c.Query("status")

	s.detectorManager.mu.RLock()
	allDetectors := make([]*DetectorInstance, 0, len(s.detectorManager.detectors))
	for _, detector := range s.detectorManager.detectors {
		// Apply filters
		if detectorType != "" && string(detector.Type) != detectorType {
			continue
		}
		if status != "" && detector.Status != status {
			continue
		}
		allDetectors = append(allDetectors, detector)
	}
	s.detectorManager.mu.RUnlock()

	// Apply pagination
	total := len(allDetectors)
	start := (page - 1) * limit
	end := start + limit

	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	detectors := allDetectors[start:end]

	// Prepare response
	responses := make([]*DetectorResponse, len(detectors))
	for i, d := range detectors {
		responses[i] = &DetectorResponse{DetectorInstance: d}
	}

	c.JSON(http.StatusOK, gin.H{
		"detectors": responses,
		"pagination": gin.H{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": (total + limit - 1) / limit,
		},
	})
}

// handleGetDetector returns a specific detector by ID
func (s *Server) handleGetDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.RLock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	s.detectorManager.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	// Include health information if requested
	response := &DetectorResponse{DetectorInstance: detectorInstance}
	if c.Query("include_health") == "true" {
		if healthCheck, ok := detectorInstance.Detector.(detector.HealthCheckDetector); ok {
			response.Health = healthCheck.Health()
		}
	}

	c.JSON(http.StatusOK, response)
}

// handleUpdateDetector updates an existing detector configuration
func (s *Server) handleUpdateDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.Lock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	if !exists {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	var req DetectorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update detector configuration
	if configurable, ok := detectorInstance.Detector.(detector.ConfigurableDetector); ok {
		if err := configurable.Configure(req.Config); err != nil {
			s.detectorManager.mu.Unlock()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Update instance metadata
	detectorInstance.Name = req.Name
	detectorInstance.Config = req.Config
	detectorInstance.UpdatedAt = time.Now()

	s.detectorManager.mu.Unlock()

	response := &DetectorResponse{DetectorInstance: detectorInstance}
	c.JSON(http.StatusOK, response)
}

// handleDeleteDetector removes a detector instance
func (s *Server) handleDeleteDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.Lock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	if !exists {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	// Stop detector if running
	if detectorInstance.Status == "running" {
		detectorInstance.Status = "stopped"
	}

	// Remove from manager
	delete(s.detectorManager.detectors, id)
	s.detectorManager.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"message": "detector deleted successfully"})
}

// handleStartDetector starts a detector instance
func (s *Server) handleStartDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.Lock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	if !exists {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	if detectorInstance.Status == "running" {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "detector already running"})
		return
	}

	detectorInstance.Status = "running"
	detectorInstance.UpdatedAt = time.Now()
	s.detectorManager.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "detector started successfully",
		"status":  "running",
	})
}

// handleStopDetector stops a detector instance
func (s *Server) handleStopDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.Lock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	if !exists {
		s.detectorManager.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	detectorInstance.Status = "stopped"
	detectorInstance.UpdatedAt = time.Now()
	s.detectorManager.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "detector stopped successfully",
		"status":  "stopped",
	})
}

// handleGetDetectorStatus returns real-time status of a detector
func (s *Server) handleGetDetectorStatus(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.RLock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	s.detectorManager.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	status := gin.H{
		"id":         detectorInstance.ID,
		"name":       detectorInstance.Name,
		"type":       detectorInstance.Type,
		"status":     detectorInstance.Status,
		"updated_at": detectorInstance.UpdatedAt,
		"metrics":    detectorInstance.Metrics,
	}

	// Add statistics if available
	if configurable, ok := detectorInstance.Detector.(detector.ConfigurableDetector); ok {
		status["statistics"] = configurable.GetStatistics()
	}

	c.JSON(http.StatusOK, status)
}

// handleGetDetectorHealth returns health information for a detector
func (s *Server) handleGetDetectorHealth(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.RLock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	s.detectorManager.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	health := gin.H{
		"id":     detectorInstance.ID,
		"name":   detectorInstance.Name,
		"status": detectorInstance.Status,
	}

	// Get health information if available
	if healthCheck, ok := detectorInstance.Detector.(detector.HealthCheckDetector); ok {
		health["health"] = healthCheck.Health()
	} else {
		health["health"] = gin.H{
			"status":  "unknown",
			"message": "health check not available for this detector type",
		}
	}

	c.JSON(http.StatusOK, health)
}

// handleRunDetection runs a single detection on provided data
func (s *Server) handleRunDetection(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.RLock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	s.detectorManager.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	var request struct {
		Value  float64   `json:"value" binding:"required"`
		Values []float64 `json:"values,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Run detection
	start := time.Now()

	if len(request.Values) > 0 {
		// Use IsAnomaly for multiple values
		isAnomaly, score, err := detectorInstance.Detector.IsAnomaly(request.Values)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"detector_id":    id,
			"is_anomaly":     isAnomaly,
			"anomaly_score":  score,
			"values":         request.Values,
			"detection_time": time.Since(start).Milliseconds(),
		})
	} else {
		// Use Detect for single value
		anomaly, err := detectorInstance.Detector.Detect(c.Request.Context(), request.Value)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update metrics
		s.updateDetectorMetrics(detectorInstance, anomaly != nil, time.Since(start))

		result := gin.H{
			"detector_id":    id,
			"value":          request.Value,
			"detection_time": time.Since(start).Milliseconds(),
		}

		if anomaly != nil {
			result["anomaly"] = anomaly
			result["is_anomaly"] = true
		} else {
			result["is_anomaly"] = false
		}

		c.JSON(http.StatusOK, result)
	}
}

// handleTrainDetector trains a detector with provided data
func (s *Server) handleTrainDetector(c *gin.Context) {
	id := c.Param("id")

	s.detectorManager.mu.RLock()
	detectorInstance, exists := s.detectorManager.detectors[id]
	s.detectorManager.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "detector not found"})
		return
	}

	// Check if detector is trainable
	trainable, ok := detectorInstance.Detector.(detector.TrainableDetector)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "detector does not support training"})
		return
	}

	var request struct {
		Values []float64 `json:"values" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(request.Values) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "training values cannot be empty"})
		return
	}

	// Train detector
	start := time.Now()
	if err := trainable.Train(request.Values); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update instance metadata
	s.detectorManager.mu.Lock()
	detectorInstance.UpdatedAt = time.Now()
	s.detectorManager.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":       "detector trained successfully",
		"training_time": time.Since(start).Milliseconds(),
		"sample_count":  len(request.Values),
	})
}

// createDetectorInstance creates a new detector instance from request
func (s *Server) createDetectorInstance(req DetectorRequest) (*DetectorInstance, error) {
	// Create detector using factory
	detectorImpl, err := detector.NewDetector(req.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create detector: %w", err)
	}

	// Generate unique ID
	s.detectorManager.mu.Lock()
	id := fmt.Sprintf("detector_%d", s.detectorManager.nextID)
	s.detectorManager.nextID++
	s.detectorManager.mu.Unlock()

	// Create instance
	instance := &DetectorInstance{
		ID:        id,
		Name:      req.Name,
		Type:      req.Type,
		Status:    "stopped",
		Config:    req.Config,
		Detector:  detectorImpl,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Metrics:   DetectorMetrics{},
	}

	return instance, nil
}

// updateDetectorMetrics updates runtime metrics for a detector
func (s *Server) updateDetectorMetrics(instance *DetectorInstance, anomalyDetected bool, duration time.Duration) {
	s.detectorManager.mu.Lock()
	defer s.detectorManager.mu.Unlock()

	instance.Metrics.TotalDetections++
	if anomalyDetected {
		instance.Metrics.AnomaliesFound++
	}

	if instance.Metrics.TotalDetections > 0 {
		instance.Metrics.AnomalyRate = float64(instance.Metrics.AnomaliesFound) / float64(instance.Metrics.TotalDetections)
	}

	now := time.Now()
	instance.Metrics.LastDetection = &now

	// Update average response time
	newResponseTime := float64(duration.Milliseconds())
	if instance.Metrics.AvgResponseTime == 0 {
		instance.Metrics.AvgResponseTime = newResponseTime
	} else {
		// Simple moving average
		instance.Metrics.AvgResponseTime = (instance.Metrics.AvgResponseTime + newResponseTime) / 2
	}
}
