package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/datasource"
	"github.com/yourusername/aiops-infra/src/internal/detector"
)

// DetectorConfig represents a stored detector configuration
type DetectorConfig struct {
	ID         string                `json:"id"`
	Name       string                `json:"name"`
	Type       detector.DetectorType `json:"type"`
	DataType   string                `json:"data_type"`
	Threshold  float64               `json:"threshold"`
	MinSamples int                   `json:"min_samples,omitempty"`
	WindowSize int                   `json:"window_size,omitempty"`
	NumTrees   int                   `json:"num_trees,omitempty"`
	SampleSize int                   `json:"sample_size,omitempty"`
	DataSource *datasource.Config    `json:"data_source"`
	CreatedAt  time.Time             `json:"created_at"`
	UpdatedAt  time.Time             `json:"updated_at"`
	LastRunAt  time.Time             `json:"last_run_at,omitempty"`
	IsActive   bool                  `json:"is_active"`
}

// ConfigStorage manages detector configurations
type ConfigStorage struct {
	mu       sync.RWMutex
	configs  map[string]*DetectorConfig
	filePath string
}

// NewConfigStorage creates a new configuration storage
func NewConfigStorage(filePath string) (*ConfigStorage, error) {
	storage := &ConfigStorage{
		configs:  make(map[string]*DetectorConfig),
		filePath: filePath,
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("error creating directory: %w", err)
	}

	// Load existing configurations
	if err := storage.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("error loading configurations: %w", err)
		}
		// File doesn't exist yet, that's fine
	}

	return storage, nil
}

// load reads configurations from file
func (s *ConfigStorage) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var configs []*DetectorConfig
	if err := json.Unmarshal(data, &configs); err != nil {
		return fmt.Errorf("error unmarshaling configurations: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, config := range configs {
		s.configs[config.ID] = config
	}

	return nil
}

// save writes configurations to file
func (s *ConfigStorage) save() error {
	s.mu.RLock()
	configs := make([]*DetectorConfig, 0, len(s.configs))
	for _, config := range s.configs {
		configs = append(configs, config)
	}
	s.mu.RUnlock()

	data, err := json.MarshalIndent(configs, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling configurations: %w", err)
	}

	if err := os.WriteFile(s.filePath, data, 0644); err != nil {
		return fmt.Errorf("error writing configurations: %w", err)
	}

	return nil
}

// Get retrieves a detector configuration by ID
func (s *ConfigStorage) Get(ctx context.Context, id string) (*DetectorConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	config, ok := s.configs[id]
	if !ok {
		return nil, fmt.Errorf("configuration not found: %s", id)
	}

	return config, nil
}

// List returns all detector configurations
func (s *ConfigStorage) List(ctx context.Context) ([]*DetectorConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	configs := make([]*DetectorConfig, 0, len(s.configs))
	for _, config := range s.configs {
		configs = append(configs, config)
	}

	return configs, nil
}

// Create adds a new detector configuration
func (s *ConfigStorage) Create(ctx context.Context, config *DetectorConfig) error {
	if config.ID == "" {
		return fmt.Errorf("configuration ID is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.configs[config.ID]; exists {
		return fmt.Errorf("configuration already exists: %s", config.ID)
	}

	config.CreatedAt = time.Now()
	config.UpdatedAt = config.CreatedAt
	s.configs[config.ID] = config

	return s.save()
}

// Update modifies an existing detector configuration
func (s *ConfigStorage) Update(ctx context.Context, config *DetectorConfig) error {
	if config.ID == "" {
		return fmt.Errorf("configuration ID is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.configs[config.ID]; !exists {
		return fmt.Errorf("configuration not found: %s", config.ID)
	}

	config.UpdatedAt = time.Now()
	s.configs[config.ID] = config

	return s.save()
}

// Delete removes a detector configuration
func (s *ConfigStorage) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.configs[id]; !exists {
		return fmt.Errorf("configuration not found: %s", id)
	}

	delete(s.configs, id)
	return s.save()
}

// UpdateLastRun updates the last run timestamp for a detector
func (s *ConfigStorage) UpdateLastRun(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	config, exists := s.configs[id]
	if !exists {
		return fmt.Errorf("configuration not found: %s", id)
	}

	config.LastRunAt = time.Now()
	return s.save()
}

// SetActive updates the active status of a detector
func (s *ConfigStorage) SetActive(ctx context.Context, id string, active bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	config, exists := s.configs[id]
	if !exists {
		return fmt.Errorf("configuration not found: %s", id)
	}

	config.IsActive = active
	config.UpdatedAt = time.Now()
	return s.save()
}
