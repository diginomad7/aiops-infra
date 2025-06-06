package detector

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/types"
)

// LogPattern представляет шаблон сообщения для поиска аномалий
type LogPattern struct {
	Pattern     string   // Регулярное выражение для поиска
	Severity    string   // Уровень серьезности: high, medium, low
	Description string   // Описание аномалии
	Labels      []string // Метки, которые должны присутствовать
}

// LogEntry представляет одну запись лога
type LogEntry struct {
	Timestamp time.Time
	Content   string
	Labels    map[string]string
	Level     string
}

// LogStream представляет поток логов с определенными метками
type LogStream struct {
	Labels  map[string]string
	Entries []LogEntry
}

// LogCallback определяет функцию обратного вызова для обработки собранных логов
type LogCallback func(stream *LogStream) error

// LokiCollector представляет интерфейс для коллектора логов Loki
type LokiCollector interface {
	RunQuery(ctx context.Context, query string, start, end time.Time) ([]*LogStream, error)
	AddQuery(name, query string)
	RemoveQuery(name string)
	Start(ctx context.Context)
	Stop()
}

// LogsAnomalyDetector анализирует логи на наличие аномалий
type LogsAnomalyDetector struct {
	patterns         []*LogPattern
	patternRegexps   []*regexp.Regexp
	errorThreshold   int           // Порог количества ошибок
	warningThreshold int           // Порог количества предупреждений
	timeWindow       time.Duration // Временное окно для анализа
	mu               sync.RWMutex
	anomalyChan      chan Anomaly
	lokiCollector    types.LokiCollector // Коллектор логов из Loki
}

// NewLogsAnomalyDetector создает новый детектор аномалий для логов
func NewLogsAnomalyDetector(errorThreshold, warningThreshold int, timeWindow time.Duration) (*LogsAnomalyDetector, error) {
	if timeWindow == 0 {
		timeWindow = 5 * time.Minute
	}

	return &LogsAnomalyDetector{
		patterns:         make([]*LogPattern, 0),
		patternRegexps:   make([]*regexp.Regexp, 0),
		errorThreshold:   errorThreshold,
		warningThreshold: warningThreshold,
		timeWindow:       timeWindow,
		anomalyChan:      make(chan Anomaly, 100),
	}, nil
}

// SetLokiCollector устанавливает коллектор логов Loki для детектора
func (ld *LogsAnomalyDetector) SetLokiCollector(collector types.LokiCollector) {
	ld.lokiCollector = collector
}

// AddPattern добавляет шаблон для обнаружения аномалий
func (ld *LogsAnomalyDetector) AddPattern(pattern, severity, description string, labels []string) error {
	// Компилируем регулярное выражение
	re, err := regexp.Compile(pattern)
	if err != nil {
		return fmt.Errorf("ошибка компиляции регулярного выражения: %w", err)
	}

	ld.mu.Lock()
	defer ld.mu.Unlock()

	ld.patterns = append(ld.patterns, &LogPattern{
		Pattern:     pattern,
		Severity:    severity,
		Description: description,
		Labels:      labels,
	})
	ld.patternRegexps = append(ld.patternRegexps, re)

	return nil
}

// Analyze анализирует поток логов на наличие аномалий
func (ld *LogsAnomalyDetector) Analyze(stream *types.LogStream) ([]Anomaly, error) {
	ld.mu.RLock()
	patterns := ld.patterns
	regexps := ld.patternRegexps
	ld.mu.RUnlock()

	// Результаты
	anomalies := make([]Anomaly, 0)

	// Анализ на основе шаблонов
	for i, pattern := range patterns {
		re := regexps[i]

		// Проверяем, что логи имеют нужные метки, если они указаны
		if len(pattern.Labels) > 0 {
			labelsMatch := true
			for _, requiredLabel := range pattern.Labels {
				parts := strings.SplitN(requiredLabel, "=", 2)
				if len(parts) != 2 {
					continue
				}
				key, value := parts[0], parts[1]

				actualValue, exists := stream.Labels[key]
				if !exists || actualValue != value {
					labelsMatch = false
					break
				}
			}
			if !labelsMatch {
				continue
			}
		}

		// Ищем совпадения по регулярному выражению
		for _, entry := range stream.Entries {
			if re.MatchString(entry.Content) {
				// Создаем аномалию
				anomaly := Anomaly{
					Timestamp: entry.Timestamp,
					Type:      "log_pattern",
					Severity:  pattern.Severity,
					Value:     0,
					Threshold: 0,
					Source:    "logs",
				}
				anomalies = append(anomalies, anomaly)

				// Отправляем в канал для обработки
				select {
				case ld.anomalyChan <- anomaly:
				default:
					// Канал заполнен, игнорируем
				}
			}
		}
	}

	// Анализ частоты сообщений определенного уровня
	return ld.analyzeFrequency(stream, anomalies)
}

// analyzeFrequency анализирует частоту сообщений по уровням
func (ld *LogsAnomalyDetector) analyzeFrequency(stream *types.LogStream, existingAnomalies []Anomaly) ([]Anomaly, error) {
	anomalies := make([]Anomaly, len(existingAnomalies))
	copy(anomalies, existingAnomalies)

	// Сначала фильтруем логи, которые находятся в интересующем нас временном окне
	now := time.Now()
	windowStart := now.Add(-ld.timeWindow)

	// Считаем количество сообщений каждого уровня
	errorCount := 0
	warningCount := 0

	for _, entry := range stream.Entries {
		if entry.Timestamp.Before(windowStart) {
			continue
		}

		switch entry.Level {
		case "error":
			errorCount++
		case "warning":
			warningCount++
		}
	}

	// Проверяем, превышен ли порог ошибок
	if errorCount >= ld.errorThreshold {
		anomaly := Anomaly{
			Timestamp: now,
			Type:      "high_error_rate",
			Severity:  "high",
			Value:     float64(errorCount),
			Threshold: float64(ld.errorThreshold),
			Source:    "logs",
		}
		anomalies = append(anomalies, anomaly)

		// Отправляем в канал для обработки
		select {
		case ld.anomalyChan <- anomaly:
		default:
			// Канал заполнен, игнорируем
		}
	}

	// Проверяем, превышен ли порог предупреждений
	if warningCount >= ld.warningThreshold {
		anomaly := Anomaly{
			Timestamp: now,
			Type:      "high_warning_rate",
			Severity:  "medium",
			Value:     float64(warningCount),
			Threshold: float64(ld.warningThreshold),
			Source:    "logs",
		}
		anomalies = append(anomalies, anomaly)

		// Отправляем в канал для обработки
		select {
		case ld.anomalyChan <- anomaly:
		default:
			// Канал заполнен, игнорируем
		}
	}

	return anomalies, nil
}

// GetAnomalyChan возвращает канал для получения аномалий
func (ld *LogsAnomalyDetector) GetAnomalyChan() <-chan Anomaly {
	return ld.anomalyChan
}

// LogAnomalyHandler обрабатывает поток логов
func (ld *LogsAnomalyDetector) LogAnomalyHandler(ctx context.Context, stream *types.LogStream) error {
	anomalies, err := ld.Analyze(stream)
	if err != nil {
		return fmt.Errorf("ошибка анализа логов: %w", err)
	}

	// Логируем обнаруженные аномалии
	for _, anomaly := range anomalies {
		fmt.Printf("Обнаружена аномалия в логах: %s (Серьезность: %s, Значение: %.2f, Порог: %.2f)\n",
			anomaly.Type, anomaly.Severity, anomaly.Value, anomaly.Threshold)
	}

	return nil
}

// Type возвращает тип детектора
func (ld *LogsAnomalyDetector) Type() string {
	return "logs"
}

// Name возвращает имя детектора
func (ld *LogsAnomalyDetector) Name() string {
	return "Loki Logs Anomaly Detector"
}

// IsAnomaly проверяет, является ли поток логов аномальным
func (ld *LogsAnomalyDetector) IsAnomaly(data interface{}) (bool, Anomaly, error) {
	stream, ok := data.(*types.LogStream)
	if !ok {
		return false, Anomaly{}, fmt.Errorf("неверный тип данных: ожидается *LogStream")
	}

	anomalies, err := ld.Analyze(stream)
	if err != nil {
		return false, Anomaly{}, err
	}

	if len(anomalies) > 0 {
		// Возвращаем первую аномалию
		return true, anomalies[0], nil
	}

	return false, Anomaly{}, nil
}

// QueryLoki выполняет запрос к Loki
func (ld *LogsAnomalyDetector) QueryLoki(ctx context.Context, query string, start, end time.Time) ([]*types.LogStream, error) {
	if ld.lokiCollector == nil {
		return nil, fmt.Errorf("коллектор Loki не инициализирован")
	}

	return ld.lokiCollector.RunQuery(ctx, query, start, end)
}

// GetErrorThreshold возвращает порог ошибок
func (ld *LogsAnomalyDetector) GetErrorThreshold() int {
	ld.mu.RLock()
	defer ld.mu.RUnlock()
	return ld.errorThreshold
}

// GetWarningThreshold возвращает порог предупреждений
func (ld *LogsAnomalyDetector) GetWarningThreshold() int {
	ld.mu.RLock()
	defer ld.mu.RUnlock()
	return ld.warningThreshold
}

// GetTimeWindow возвращает временное окно для анализа
func (ld *LogsAnomalyDetector) GetTimeWindow() time.Duration {
	ld.mu.RLock()
	defer ld.mu.RUnlock()
	return ld.timeWindow
}

// GetPatternCount возвращает количество шаблонов
func (ld *LogsAnomalyDetector) GetPatternCount() int {
	ld.mu.RLock()
	defer ld.mu.RUnlock()
	return len(ld.patterns)
}

// GetPatterns возвращает список шаблонов
func (ld *LogsAnomalyDetector) GetPatterns() []*LogPattern {
	ld.mu.RLock()
	defer ld.mu.RUnlock()

	patterns := make([]*LogPattern, len(ld.patterns))
	copy(patterns, ld.patterns)
	return patterns
}
