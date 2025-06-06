package types

import (
	"context"
	"time"
)

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
