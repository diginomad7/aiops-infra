package detector

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/datasource"
)

// PrometheusAnomalyDetector обнаруживает аномалии в метриках Prometheus
type PrometheusAnomalyDetector struct {
	collector      *datasource.PrometheusCollector
	detectors      map[string]Detector
	alertCallbacks []func(anomaly *AnomalyEvent) error
	mu             sync.RWMutex
	anomalyCache   map[string]time.Time
	cacheTTL       time.Duration
}

// AnomalyEvent представляет событие обнаружения аномалии
type AnomalyEvent struct {
	MetricName  string
	Timestamp   time.Time
	Value       float64
	Labels      map[string]string
	Score       float64
	Description string
	Detector    string
}

// NewPrometheusAnomalyDetector создает новый детектор аномалий Prometheus
func NewPrometheusAnomalyDetector(promURL string, collectPeriod time.Duration) (*PrometheusAnomalyDetector, error) {
	detector := &PrometheusAnomalyDetector{
		detectors:      make(map[string]Detector),
		alertCallbacks: make([]func(anomaly *AnomalyEvent) error, 0),
		anomalyCache:   make(map[string]time.Time),
		cacheTTL:       30 * time.Minute, // Период повторного оповещения по умолчанию
	}

	// Создаем функцию обратного вызова для обработки метрик
	callback := func(metricName string, timestamp time.Time, value float64, labels map[string]string) error {
		return detector.processMetric(metricName, timestamp, value, labels)
	}

	// Инициализируем коллектор метрик
	collector, err := datasource.NewPrometheusCollector(promURL, collectPeriod, callback)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания коллектора Prometheus: %w", err)
	}

	detector.collector = collector
	return detector, nil
}

// AddDetector добавляет детектор для указанной метрики
func (p *PrometheusAnomalyDetector) AddDetector(metricName string, detector Detector) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.detectors[metricName] = detector
}

// AddQuery добавляет запрос Prometheus для мониторинга
func (p *PrometheusAnomalyDetector) AddQuery(name, query string) {
	p.collector.AddQuery(name, query)
}

// RegisterAlertCallback регистрирует функцию обратного вызова для оповещений об аномалиях
func (p *PrometheusAnomalyDetector) RegisterAlertCallback(callback func(anomaly *AnomalyEvent) error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.alertCallbacks = append(p.alertCallbacks, callback)
}

// SetCacheTTL устанавливает время жизни кэша для предотвращения повторных оповещений
func (p *PrometheusAnomalyDetector) SetCacheTTL(ttl time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cacheTTL = ttl
}

// Start запускает детектор аномалий
func (p *PrometheusAnomalyDetector) Start(ctx context.Context) {
	p.collector.Start(ctx)
}

// Stop останавливает детектор аномалий
func (p *PrometheusAnomalyDetector) Stop() {
	p.collector.Stop()
}

// processMetric обрабатывает метрику и проверяет на аномалии
func (p *PrometheusAnomalyDetector) processMetric(metricName string, timestamp time.Time, value float64, labels map[string]string) error {
	p.mu.RLock()
	detector, exists := p.detectors[metricName]
	p.mu.RUnlock()

	if !exists {
		// Для этой метрики не настроен детектор аномалий
		return nil
	}

	// Проверяем, является ли значение аномальным
	isAnomaly, score, err := detector.IsAnomaly([]float64{value})
	if err != nil {
		return fmt.Errorf("ошибка обнаружения аномалии для %s: %w", metricName, err)
	}

	if isAnomaly {
		// Формируем ключ кэша для предотвращения частых оповещений
		cacheKey := fmt.Sprintf("%s_%v", metricName, labels)

		p.mu.Lock()
		lastAlert, exists := p.anomalyCache[cacheKey]
		now := time.Now()

		// Проверяем, прошло ли достаточно времени с последнего оповещения
		if !exists || now.Sub(lastAlert) > p.cacheTTL {
			// Обновляем кэш
			p.anomalyCache[cacheKey] = now
			p.mu.Unlock()

			// Создаем событие аномалии
			anomalyEvent := &AnomalyEvent{
				MetricName:  metricName,
				Timestamp:   timestamp,
				Value:       value,
				Labels:      labels,
				Score:       score,
				Description: fmt.Sprintf("Обнаружена аномалия в метрике %s. Значение: %f, Оценка: %f", metricName, value, score),
				Detector:    detector.Type(),
			}

			// Отправляем оповещения через все зарегистрированные обработчики
			p.notifyAnomalyCallbacks(anomalyEvent)

			// Логируем аномалию
			log.Printf("АНОМАЛИЯ: %s, Значение: %f, Оценка: %f, Метки: %v",
				metricName, value, score, labels)
		} else {
			p.mu.Unlock()
		}
	}

	return nil
}

// notifyAnomalyCallbacks отправляет оповещения об аномалии всем зарегистрированным обработчикам
func (p *PrometheusAnomalyDetector) notifyAnomalyCallbacks(anomaly *AnomalyEvent) {
	p.mu.RLock()
	callbacks := make([]func(anomaly *AnomalyEvent) error, len(p.alertCallbacks))
	copy(callbacks, p.alertCallbacks)
	p.mu.RUnlock()

	for _, callback := range callbacks {
		if err := callback(anomaly); err != nil {
			log.Printf("Ошибка отправки оповещения об аномалии: %v", err)
		}
	}
}

// RunAdHocCheck выполняет проверку на аномалии по запросу
func (p *PrometheusAnomalyDetector) RunAdHocCheck(ctx context.Context, query string, detectorConfig DetectorConfig) ([]*AnomalyEvent, error) {
	// Создаем детектор для ad-hoc проверки
	detector, err := NewDetector(detectorConfig)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания детектора: %w", err)
	}

	// Запрашиваем данные из Prometheus
	results, err := p.collector.RunInstantQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса к Prometheus: %w", err)
	}

	// Обрабатываем результаты
	anomalies := make([]*AnomalyEvent, 0)
	for _, result := range results {
		isAnomaly, score, err := detector.IsAnomaly([]float64{result.Value})
		if err != nil {
			log.Printf("Ошибка обнаружения аномалии для %s: %v", result.Name, err)
			continue
		}

		if isAnomaly {
			anomalyEvent := &AnomalyEvent{
				MetricName:  result.Name,
				Timestamp:   result.Timestamp,
				Value:       result.Value,
				Labels:      result.Labels,
				Score:       score,
				Description: fmt.Sprintf("Обнаружена аномалия в метрике %s. Значение: %f, Оценка: %f", result.Name, result.Value, score),
				Detector:    detector.Type(),
			}
			anomalies = append(anomalies, anomalyEvent)
		}
	}

	return anomalies, nil
}

// AnalyzeHistoricalData анализирует исторические данные за указанный период
func (p *PrometheusAnomalyDetector) AnalyzeHistoricalData(ctx context.Context, query string, detectorConfig DetectorConfig, start, end time.Time, step time.Duration) ([]*AnomalyEvent, error) {
	// Создаем детектор для анализа исторических данных
	detector, err := NewDetector(detectorConfig)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания детектора: %w", err)
	}

	// Запрашиваем диапазон данных из Prometheus
	series, err := p.collector.RunRangeQuery(ctx, query, start, end, step)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса диапазона к Prometheus: %w", err)
	}

	// Обрабатываем результаты
	anomalies := make([]*AnomalyEvent, 0)
	for _, s := range series {
		// Собираем значения для анализа
		values := make([]float64, len(s.Points))
		for i, point := range s.Points {
			values[i] = point.Value
		}

		// Если имеем достаточно точек, обучаем детектор на всех данных,
		// а затем проверяем каждую точку в отдельности
		if len(values) > 10 {
			// Проверяем, поддерживает ли детектор обучение
			trainable, ok := detector.(TrainableDetector)
			if ok {
				if err := trainable.Train(values); err != nil {
					log.Printf("Ошибка обучения детектора: %v", err)
					continue
				}
			}

			// Проверяем каждую точку
			for _, point := range s.Points {
				// Для каждой точки проверяем, является ли она аномалией
				isAnomaly, score, err := detector.IsAnomaly([]float64{point.Value})
				if err != nil {
					log.Printf("Ошибка обнаружения аномалии: %v", err)
					continue
				}

				if isAnomaly {
					anomalyEvent := &AnomalyEvent{
						MetricName:  query, // Используем запрос как имя метрики
						Timestamp:   point.Timestamp,
						Value:       point.Value,
						Labels:      s.Labels,
						Score:       score,
						Description: fmt.Sprintf("Обнаружена историческая аномалия. Значение: %f, Оценка: %f", point.Value, score),
						Detector:    detector.Type(),
					}
					anomalies = append(anomalies, anomalyEvent)
				}
			}
		}
	}

	return anomalies, nil
}
