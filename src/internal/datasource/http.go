package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/tidwall/gjson"
)

// HTTPSource implements data collection from HTTP endpoints
type HTTPSource struct {
	name    string
	url     string
	method  string
	headers map[string]string
	path    string
	client  *http.Client
}

// NewHTTPSource creates a new HTTP data source
func NewHTTPSource(config *Config) (*HTTPSource, error) {
	if config.Type != TypeHTTP {
		return nil, fmt.Errorf("invalid source type: %s", config.Type)
	}

	if config.HTTPMethod == "" {
		config.HTTPMethod = http.MethodGet
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	return &HTTPSource{
		name:    config.Name,
		url:     config.HTTPURL,
		method:  config.HTTPMethod,
		headers: config.HTTPHeaders,
		path:    config.JSONPath,
		client:  client,
	}, nil
}

// Name returns the name of the data source
func (s *HTTPSource) Name() string {
	return s.name
}

// Type returns the type of the data source
func (s *HTTPSource) Type() SourceType {
	return TypeHTTP
}

// Collect retrieves data points from HTTP endpoint
func (s *HTTPSource) Collect(ctx context.Context) ([]DataPoint, error) {
	req, err := http.NewRequestWithContext(ctx, s.method, s.url, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	for key, value := range s.headers {
		req.Header.Set(key, value)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error making request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Parse response using gjson
	result := gjson.GetBytes(body, s.path)
	if !result.Exists() {
		return nil, fmt.Errorf("JSON path %s not found in response", s.path)
	}

	var points []DataPoint
	timestamp := time.Now()

	switch {
	case result.IsArray():
		// Handle array of values
		result.ForEach(func(key, value gjson.Result) bool {
			if value.Type == gjson.Number {
				points = append(points, DataPoint{
					Timestamp: timestamp,
					Value:     value.Float(),
					Labels:    make(map[string]string),
				})
			}
			return true
		})

	case result.Type == gjson.Number:
		// Handle single numeric value
		points = append(points, DataPoint{
			Timestamp: timestamp,
			Value:     result.Float(),
			Labels:    make(map[string]string),
		})

	case result.IsObject():
		// Handle object with multiple values
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(result.Raw), &data); err != nil {
			return nil, fmt.Errorf("error parsing JSON object: %w", err)
		}

		for key, value := range data {
			if num, ok := value.(float64); ok {
				points = append(points, DataPoint{
					Timestamp: timestamp,
					Value:     num,
					Labels: map[string]string{
						"key": key,
					},
				})
			}
		}

	default:
		return nil, fmt.Errorf("unsupported value type at path %s", s.path)
	}

	if len(points) == 0 {
		return nil, fmt.Errorf("no numeric values found at path %s", s.path)
	}

	return points, nil
}

// Close releases any resources used by the data source
func (s *HTTPSource) Close() error {
	s.client.CloseIdleConnections()
	return nil
}
