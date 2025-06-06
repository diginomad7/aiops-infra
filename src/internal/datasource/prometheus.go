package datasource

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// PrometheusSource implements data collection from Prometheus
type PrometheusSource struct {
	name   string
	client v1.API
	query  string
}

// NewPrometheusSource creates a new Prometheus data source
func NewPrometheusSource(config *Config) (*PrometheusSource, error) {
	if config.Type != TypePrometheus {
		return nil, fmt.Errorf("invalid source type: %s", config.Type)
	}

	clientConfig := api.Config{
		Address: config.PrometheusURL,
	}

	if config.PrometheusAuth.Username != "" && config.PrometheusAuth.Password != "" {
		// Создаем транспорт с базовой аутентификацией
		rt := &basicAuthRoundTripper{
			username: config.PrometheusAuth.Username,
			password: config.PrometheusAuth.Password,
			rt:       api.DefaultRoundTripper,
		}
		clientConfig.RoundTripper = rt
	} else if config.PrometheusAuth.Token != "" {
		// Создаем транспорт с токеном авторизации
		rt := &tokenAuthRoundTripper{
			token: config.PrometheusAuth.Token,
			rt:    api.DefaultRoundTripper,
		}
		clientConfig.RoundTripper = rt
	}

	client, err := api.NewClient(clientConfig)
	if err != nil {
		return nil, fmt.Errorf("error creating prometheus client: %w", err)
	}

	return &PrometheusSource{
		name:   config.Name,
		client: v1.NewAPI(client),
		query:  config.PromQL,
	}, nil
}

// Name returns the name of the data source
func (s *PrometheusSource) Name() string {
	return s.name
}

// Type returns the type of the data source
func (s *PrometheusSource) Type() SourceType {
	return TypePrometheus
}

// Collect retrieves data points from Prometheus
func (s *PrometheusSource) Collect(ctx context.Context) ([]DataPoint, error) {
	result, warnings, err := s.client.Query(ctx, s.query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("error querying prometheus: %w", err)
	}

	if len(warnings) > 0 {
		// Log warnings but continue processing
		fmt.Printf("Warnings from Prometheus query: %v\n", warnings)
	}

	vector, ok := result.(model.Vector)
	if !ok {
		return nil, fmt.Errorf("unexpected result type: %T", result)
	}

	points := make([]DataPoint, 0, len(vector))
	for _, sample := range vector {
		labels := make(map[string]string, len(sample.Metric))
		for name, value := range sample.Metric {
			labels[string(name)] = string(value)
		}

		points = append(points, DataPoint{
			Timestamp: sample.Timestamp.Time(),
			Value:     float64(sample.Value),
			Labels:    labels,
		})
	}

	return points, nil
}

// Close releases any resources used by the data source
func (s *PrometheusSource) Close() error {
	return nil
}

// basicAuthRoundTripper реализация RoundTripper для HTTP Basic Authentication
type basicAuthRoundTripper struct {
	username string
	password string
	rt       http.RoundTripper
}

// RoundTrip implements the http.RoundTripper interface
func (rt *basicAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req = cloneRequest(req)
	req.SetBasicAuth(rt.username, rt.password)
	return rt.rt.RoundTrip(req)
}

// tokenAuthRoundTripper реализация RoundTripper для авторизации по токену
type tokenAuthRoundTripper struct {
	token string
	rt    http.RoundTripper
}

// RoundTrip implements the http.RoundTripper interface
func (rt *tokenAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req = cloneRequest(req)
	req.Header.Set("Authorization", "Bearer "+rt.token)
	return rt.rt.RoundTrip(req)
}

// cloneRequest создает клон HTTP-запроса для безопасного изменения
func cloneRequest(r *http.Request) *http.Request {
	// shallow copy
	r2 := new(http.Request)
	*r2 = *r

	// клонируем Header
	r2.Header = make(http.Header, len(r.Header))
	for k, s := range r.Header {
		r2.Header[k] = append([]string(nil), s...)
	}

	return r2
}
