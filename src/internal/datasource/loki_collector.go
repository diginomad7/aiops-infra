package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/types"
)

// LokiCollector собирает логи из Loki
type LokiCollector struct {
	url            string
	client         *http.Client
	interval       time.Duration
	lookback       time.Duration
	queries        map[string]string
	mu             sync.RWMutex
	done           chan struct{}
	callback       types.LogCallback
	lastQueryTimes map[string]time.Time
}

// NewLokiCollector создает новый коллектор логов Loki
func NewLokiCollector(url string, interval, lookback time.Duration, callback types.LogCallback) (*LokiCollector, error) {
	if url == "" {
		return nil, fmt.Errorf("URL не может быть пустым")
	}

	if interval == 0 {
		interval = 1 * time.Minute
	}

	if lookback == 0 {
		lookback = 5 * time.Minute
	}

	return &LokiCollector{
		url:            url,
		client:         &http.Client{Timeout: 30 * time.Second},
		interval:       interval,
		lookback:       lookback,
		queries:        make(map[string]string),
		done:           make(chan struct{}),
		callback:       callback,
		lastQueryTimes: make(map[string]time.Time),
	}, nil
}

// AddQuery добавляет запрос для регулярного выполнения
func (lc *LokiCollector) AddQuery(name, query string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.queries[name] = query
	lc.lastQueryTimes[name] = time.Now().Add(-lc.lookback)
}

// RemoveQuery удаляет запрос
func (lc *LokiCollector) RemoveQuery(name string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	delete(lc.queries, name)
	delete(lc.lastQueryTimes, name)
}

// Start запускает периодический сбор логов
func (lc *LokiCollector) Start(ctx context.Context) {
	go lc.collectLoop(ctx)
}

// Stop останавливает сбор логов
func (lc *LokiCollector) Stop() {
	close(lc.done)
}

// collectLoop запускает периодический сбор логов
func (lc *LokiCollector) collectLoop(ctx context.Context) {
	ticker := time.NewTicker(lc.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-lc.done:
			return
		case <-ticker.C:
			lc.collectLogs(ctx)
		}
	}
}

// LogStreamInternal представляет внутренний поток логов
type LogStreamInternal struct {
	Labels  map[string]string
	Entries []LogEntryInternal
}

// LogEntryInternal представляет внутреннюю запись лога
type LogEntryInternal struct {
	Timestamp time.Time
	Content   string
	Labels    map[string]string
	Level     string
}

// collectLogs собирает логи для всех запросов
func (lc *LokiCollector) collectLogs(ctx context.Context) {
	lc.mu.RLock()
	queries := make(map[string]string, len(lc.queries))
	lastTimes := make(map[string]time.Time, len(lc.lastQueryTimes))
	for name, query := range lc.queries {
		queries[name] = query
		lastTimes[name] = lc.lastQueryTimes[name]
	}
	lc.mu.RUnlock()

	now := time.Now()

	for name, query := range queries {
		lastTime := lastTimes[name]
		streams, err := lc.queryLoki(ctx, query, lastTime, now)
		if err != nil {
			// Логируем ошибку и продолжаем
			fmt.Printf("Ошибка запроса Loki для '%s': %v\n", name, err)
			continue
		}

		// Обновляем время последнего запроса
		lc.mu.Lock()
		lc.lastQueryTimes[name] = now
		lc.mu.Unlock()

		// Вызываем обработчик для каждого потока
		for _, stream := range streams {
			// Преобразуем в формат types.LogStream
			typesStream := &types.LogStream{
				Labels:  stream.Labels,
				Entries: make([]types.LogEntry, len(stream.Entries)),
			}

			for i, entry := range stream.Entries {
				typesStream.Entries[i] = types.LogEntry{
					Timestamp: entry.Timestamp,
					Content:   entry.Content,
					Labels:    entry.Labels,
					Level:     entry.Level,
				}
			}

			// Вызываем обработчик
			if lc.callback != nil {
				if err := lc.callback(typesStream); err != nil {
					fmt.Printf("Ошибка обработки логов для '%s': %v\n", name, err)
				}
			}
		}
	}
}

// queryLoki выполняет запрос к Loki API и возвращает логи
func (lc *LokiCollector) queryLoki(ctx context.Context, query string, start, end time.Time) ([]*LogStreamInternal, error) {
	// Формируем URL запроса к Loki API
	queryURL, err := url.Parse(fmt.Sprintf("%s/loki/api/v1/query_range", lc.url))
	if err != nil {
		return nil, fmt.Errorf("ошибка при формировании URL: %w", err)
	}

	// Добавляем параметры запроса
	params := url.Values{}
	params.Add("query", query)
	params.Add("start", fmt.Sprintf("%d", start.UnixNano()))
	params.Add("end", fmt.Sprintf("%d", end.UnixNano()))
	params.Add("limit", "5000")
	queryURL.RawQuery = params.Encode()

	// Выполняем запрос
	req, err := http.NewRequestWithContext(ctx, "GET", queryURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка при создании HTTP запроса: %w", err)
	}

	resp, err := lc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ошибка HTTP запроса к Loki: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("Loki вернул ошибку (код %d): %s", resp.StatusCode, string(body))
	}

	// Парсим ответ
	var lokiResponse struct {
		Status string `json:"status"`
		Data   struct {
			ResultType string `json:"resultType"`
			Result     []struct {
				Stream map[string]string `json:"stream"`
				Values [][]string        `json:"values"` // [timestamp, log]
			} `json:"result"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&lokiResponse); err != nil {
		return nil, fmt.Errorf("ошибка парсинга ответа Loki: %w", err)
	}

	if lokiResponse.Status != "success" {
		return nil, fmt.Errorf("Loki вернул статус: %s", lokiResponse.Status)
	}

	// Создаем результат
	streams := make([]*LogStreamInternal, 0, len(lokiResponse.Data.Result))

	// Обрабатываем результаты для каждого потока логов
	for _, result := range lokiResponse.Data.Result {
		stream := &LogStreamInternal{
			Labels:  result.Stream,
			Entries: make([]LogEntryInternal, 0, len(result.Values)),
		}

		for _, value := range result.Values {
			if len(value) != 2 {
				continue
			}

			// Парсим временную метку
			var timestampNano int64
			if _, err := fmt.Sscanf(value[0], "%d", &timestampNano); err != nil {
				fmt.Printf("ошибка парсинга временной метки: %v\n", err)
				continue
			}

			timestamp := time.Unix(0, timestampNano)
			content := value[1]

			// Определяем уровень логирования из содержимого
			level := extractLogLevel(content)

			// Добавляем запись в поток
			stream.Entries = append(stream.Entries, LogEntryInternal{
				Timestamp: timestamp,
				Content:   content,
				Labels:    result.Stream,
				Level:     level,
			})
		}

		// Добавляем поток в результат, если есть записи
		if len(stream.Entries) > 0 {
			streams = append(streams, stream)
		}
	}

	return streams, nil
}

// RunQuery выполняет разовый запрос к Loki API
func (lc *LokiCollector) RunQuery(ctx context.Context, query string, start, end time.Time) ([]*types.LogStream, error) {
	// Выполняем запрос
	streams, err := lc.queryLoki(ctx, query, start, end)
	if err != nil {
		return nil, err
	}

	// Преобразуем в формат types.LogStream
	result := make([]*types.LogStream, len(streams))
	for i, stream := range streams {
		result[i] = &types.LogStream{
			Labels:  stream.Labels,
			Entries: make([]types.LogEntry, len(stream.Entries)),
		}

		for j, entry := range stream.Entries {
			result[i].Entries[j] = types.LogEntry{
				Timestamp: entry.Timestamp,
				Content:   entry.Content,
				Labels:    entry.Labels,
				Level:     entry.Level,
			}
		}
	}

	return result, nil
}

// extractLogLevel извлекает уровень логирования из содержимого сообщения
func extractLogLevel(content string) string {
	content = strings.ToLower(content)

	if strings.Contains(content, "error") || strings.Contains(content, "err]") || strings.Contains(content, "erro]") {
		return "error"
	}

	if strings.Contains(content, "warn") || strings.Contains(content, "warning") {
		return "warning"
	}

	if strings.Contains(content, "info") {
		return "info"
	}

	if strings.Contains(content, "debug") {
		return "debug"
	}

	return "unknown"
}
