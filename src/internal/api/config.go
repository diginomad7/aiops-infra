package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/yourusername/aiops-infra/src/internal/detector"
)

// DetectorConfig represents the configuration for a detector
type DetectorConfig struct {
	Type       string  `json:"type"`
	DataType   string  `json:"data_type"`
	Threshold  float64 `json:"threshold"`
	WindowSize int     `json:"window_size,omitempty"`
	NumTrees   int     `json:"num_trees,omitempty"`
	SampleSize int     `json:"sample_size,omitempty"`
}

// ConfigHandler handles detector configuration updates
type ConfigHandler struct {
	mu        sync.RWMutex
	detectors map[string]detector.Detector
}

// NewConfigHandler creates a new configuration handler
func NewConfigHandler() *ConfigHandler {
	return &ConfigHandler{
		detectors: make(map[string]detector.Detector),
	}
}

// GetDetector returns a detector by data type
func (h *ConfigHandler) GetDetector(dataType string) detector.Detector {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.detectors[dataType]
}

// SetDetector sets a detector for a data type
func (h *ConfigHandler) SetDetector(dataType string, d detector.Detector) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.detectors[dataType] = d
}

// ServeHTTP handles HTTP requests for detector configuration
func (h *ConfigHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config DetectorConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	detectorConfig := detector.DetectorConfig{
		DataType:   config.DataType,
		Threshold:  config.Threshold,
		WindowSize: config.WindowSize,
		NumTrees:   config.NumTrees,
		SampleSize: config.SampleSize,
	}

	switch config.Type {
	case "statistical":
		detectorConfig.Type = detector.TypeStatistical
	case "window":
		detectorConfig.Type = detector.TypeWindow
	case "isolation_forest":
		detectorConfig.Type = detector.TypeIsolationForest
	default:
		http.Error(w, fmt.Sprintf("Unknown detector type: %s", config.Type), http.StatusBadRequest)
		return
	}

	d, err := detector.NewDetector(detectorConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create detector: %v", err), http.StatusBadRequest)
		return
	}

	h.SetDetector(config.DataType, d)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"message": fmt.Sprintf("Detector configured for %s", config.DataType),
	})
}
