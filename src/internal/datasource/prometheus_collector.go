package datasource

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// PrometheusCollector автоматически собирает метрики из Prometheus
type PrometheusCollector struct {
	api           v1.API
	queries       map[string]string
	collectPeriod time.Duration
	callback      MetricCallback
	mu            sync.RWMutex
	stopCh        chan struct{}
	wg            sync.WaitGroup
}

// MetricCallback определяет функцию обратного вызова для обработки собранных метрик
type MetricCallback func(metricName string, timestamp time.Time, value float64, labels map[string]string) error

// NewPrometheusCollector создаёт новый коллектор метрик Prometheus
func NewPrometheusCollector(promURL string, collectPeriod time.Duration, callback MetricCallback) (*PrometheusCollector, error) {
	client, err := api.NewClient(api.Config{
		Address: promURL,
	})
	if err != nil {
		return nil, fmt.Errorf("ошибка создания клиента Prometheus: %w", err)
	}

	return &PrometheusCollector{
		api:           v1.NewAPI(client),
		queries:       make(map[string]string),
		collectPeriod: collectPeriod,
		callback:      callback,
		stopCh:        make(chan struct{}),
	}, nil
}

// AddQuery добавляет запрос Prometheus для регулярного выполнения
func (pc *PrometheusCollector) AddQuery(name, query string) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	pc.queries[name] = query
}

// RemoveQuery удаляет запрос Prometheus
func (pc *PrometheusCollector) RemoveQuery(name string) {
	pc.mu.Lock()
	defer pc.mu.Unlock()
	delete(pc.queries, name)
}

// Start запускает сбор метрик в фоне
func (pc *PrometheusCollector) Start(ctx context.Context) {
	pc.wg.Add(1)
	go func() {
		defer pc.wg.Done()

		ticker := time.NewTicker(pc.collectPeriod)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				pc.collectMetrics(ctx)
			case <-pc.stopCh:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Stop останавливает сбор метрик
func (pc *PrometheusCollector) Stop() {
	close(pc.stopCh)
	pc.wg.Wait()
}

// collectMetrics собирает все зарегистрированные метрики
func (pc *PrometheusCollector) collectMetrics(ctx context.Context) {
	pc.mu.RLock()
	queries := make(map[string]string, len(pc.queries))
	for k, v := range pc.queries {
		queries[k] = v
	}
	pc.mu.RUnlock()

	for name, query := range queries {
		err := pc.executeQuery(ctx, name, query)
		if err != nil {
			log.Printf("ошибка выполнения запроса %s: %v", name, err)
		}
	}
}

// executeQuery выполняет один запрос Prometheus
func (pc *PrometheusCollector) executeQuery(ctx context.Context, name, query string) error {
	result, warnings, err := pc.api.Query(ctx, query, time.Now())
	if err != nil {
		return fmt.Errorf("ошибка запроса к Prometheus: %w", err)
	}

	if len(warnings) > 0 {
		log.Printf("предупреждения при выполнении запроса %s: %v", name, warnings)
	}

	// Обработка результатов запроса
	switch resultType := result.Type(); resultType {
	case model.ValVector:
		vector, ok := result.(model.Vector)
		if !ok {
			return fmt.Errorf("ошибка приведения результата к типу Vector")
		}

		for _, sample := range vector {
			labels := make(map[string]string, len(sample.Metric))
			for k, v := range sample.Metric {
				labels[string(k)] = string(v)
			}

			timestamp := time.Unix(sample.Timestamp.Unix(), 0)
			value := float64(sample.Value)

			if err := pc.callback(name, timestamp, value, labels); err != nil {
				log.Printf("ошибка обработки метрики %s: %v", name, err)
			}
		}

	case model.ValMatrix:
		matrix, ok := result.(model.Matrix)
		if !ok {
			return fmt.Errorf("ошибка приведения результата к типу Matrix")
		}

		for _, stream := range matrix {
			labels := make(map[string]string, len(stream.Metric))
			for k, v := range stream.Metric {
				labels[string(k)] = string(v)
			}

			for _, value := range stream.Values {
				timestamp := time.Unix(value.Timestamp.Unix(), 0)
				val := float64(value.Value)

				if err := pc.callback(name, timestamp, val, labels); err != nil {
					log.Printf("ошибка обработки метрики %s: %v", name, err)
				}
			}
		}

	default:
		return fmt.Errorf("неподдерживаемый тип результата: %s", resultType)
	}

	return nil
}

// RunInstantQuery выполняет моментальный запрос и возвращает результаты
func (pc *PrometheusCollector) RunInstantQuery(ctx context.Context, query string) ([]MetricResult, error) {
	result, warnings, err := pc.api.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса к Prometheus: %w", err)
	}

	if len(warnings) > 0 {
		log.Printf("предупреждения при выполнении запроса: %v", warnings)
	}

	return parseQueryResult(result)
}

// RunRangeQuery выполняет запрос за период времени и возвращает результаты
func (pc *PrometheusCollector) RunRangeQuery(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]MetricSeries, error) {
	r := v1.Range{
		Start: start,
		End:   end,
		Step:  step,
	}

	result, warnings, err := pc.api.QueryRange(ctx, query, r)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса к Prometheus: %w", err)
	}

	if len(warnings) > 0 {
		log.Printf("предупреждения при выполнении запроса диапазона: %v", warnings)
	}

	return parseRangeResult(result)
}

// MetricResult представляет одно значение метрики
type MetricResult struct {
	Name      string
	Value     float64
	Timestamp time.Time
	Labels    map[string]string
}

// MetricSeries представляет серию значений метрики
type MetricSeries struct {
	Labels map[string]string
	Points []MetricPoint
}

// MetricPoint представляет значение метрики в определенный момент времени
type MetricPoint struct {
	Value     float64
	Timestamp time.Time
}

// parseQueryResult преобразует результат запроса Prometheus в структурированные данные
func parseQueryResult(result model.Value) ([]MetricResult, error) {
	var metrics []MetricResult

	switch resultType := result.Type(); resultType {
	case model.ValVector:
		vector, ok := result.(model.Vector)
		if !ok {
			return nil, fmt.Errorf("ошибка приведения результата к типу Vector")
		}

		for _, sample := range vector {
			labels := make(map[string]string, len(sample.Metric))
			for k, v := range sample.Metric {
				labels[string(k)] = string(v)
			}

			metrics = append(metrics, MetricResult{
				Name:      string(sample.Metric[model.MetricNameLabel]),
				Value:     float64(sample.Value),
				Timestamp: time.Unix(sample.Timestamp.Unix(), 0),
				Labels:    labels,
			})
		}

	case model.ValScalar:
		scalar, ok := result.(*model.Scalar)
		if !ok {
			return nil, fmt.Errorf("ошибка приведения результата к типу Scalar")
		}

		metrics = append(metrics, MetricResult{
			Name:      "scalar",
			Value:     float64(scalar.Value),
			Timestamp: time.Unix(scalar.Timestamp.Unix(), 0),
			Labels:    make(map[string]string),
		})

	default:
		return nil, fmt.Errorf("неподдерживаемый тип результата: %s", resultType)
	}

	return metrics, nil
}

// parseRangeResult преобразует результат запроса диапазона Prometheus в структурированные данные
func parseRangeResult(result model.Value) ([]MetricSeries, error) {
	var series []MetricSeries

	matrix, ok := result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("ошибка приведения результата к типу Matrix")
	}

	for _, stream := range matrix {
		labels := make(map[string]string, len(stream.Metric))
		for k, v := range stream.Metric {
			labels[string(k)] = string(v)
		}

		points := make([]MetricPoint, len(stream.Values))
		for i, value := range stream.Values {
			points[i] = MetricPoint{
				Value:     float64(value.Value),
				Timestamp: time.Unix(value.Timestamp.Unix(), 0),
			}
		}

		series = append(series, MetricSeries{
			Labels: labels,
			Points: points,
		})
	}

	return series, nil
}
