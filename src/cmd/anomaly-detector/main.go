package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/api"
	"github.com/yourusername/aiops-infra/src/internal/config"
	"github.com/yourusername/aiops-infra/src/internal/datasource"
	"github.com/yourusername/aiops-infra/src/internal/detector"
	"github.com/yourusername/aiops-infra/src/internal/orchestrator"
	"github.com/yourusername/aiops-infra/src/internal/types"
)

var (
	configPath        = flag.String("config", "configs/config.yaml", "Path to configuration file")
	lokiPatternsPath  = flag.String("loki-patterns", "configs/loki_patterns.yaml", "Path to Loki patterns configuration")
	prometheusQueries = flag.String("prometheus-queries", "configs/prometheus_queries.yaml", "Path to Prometheus queries configuration")
	listenAddr        = flag.String("listen", ":8080", "HTTP server address")
	metricsAddr       = flag.String("metrics", ":9090", "Metrics server address")
	kubeconfigPath    = flag.String("kubeconfig", "", "Kubeconfig file path (if empty, in-cluster config is used)")
	scriptsDir        = flag.String("scripts-dir", "./scripts", "Directory containing remediation scripts")
	slackWebhook      = flag.String("slack-webhook", "", "Slack webhook URL for notifications")
)

func main() {
	flag.Parse()

	log.Println("Starting AIOps Anomaly Detector")

	// Загружаем конфигурацию
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	// Создаем корневой контекст с отменой
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Инициализируем оркестратор
	orch := orchestrator.NewOrchestrator()

	// Инициализируем обработчики действий
	initActionHandlers(orch, *scriptsDir, *kubeconfigPath, *slackWebhook)

	// Инициализируем Prometheus коллектор, если включен
	var promDetector *detector.PrometheusAnomalyDetector
	if cfg.Prometheus.Enabled {
		promDetector, err = initPrometheusDetector(ctx, cfg.Prometheus.URL, orch)
		if err != nil {
			log.Printf("Warning: Failed to initialize Prometheus detector: %v", err)
		} else {
			log.Printf("Prometheus integration started with URL: %s", cfg.Prometheus.URL)
		}
	}

	// Инициализируем Loki коллектор, если включен
	var logsDetector *detector.LogsAnomalyDetector
	if cfg.Loki.Enabled {
		logsDetector, err = initLokiDetector(ctx, cfg.Loki.URL, *lokiPatternsPath, orch)
		if err != nil {
			log.Printf("Warning: Failed to initialize Loki detector: %v", err)
		} else {
			log.Printf("Loki integration started with URL: %s", cfg.Loki.URL)
		}
	}

	// Создаем сервер API
	server := api.NewServer(orch)

	// Регистрируем детекторы в API
	if promDetector != nil {
		server.RegisterPrometheusDetector(promDetector)
	}

	if logsDetector != nil {
		server.RegisterLogsDetector(logsDetector)
	}

	// Запускаем HTTP сервер
	go func() {
		log.Printf("Starting HTTP server on %s", *listenAddr)
		if err := server.Start(*listenAddr); err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Ожидаем сигнала завершения
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	log.Println("Shutting down...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	// Останавливаем API сервер
	if err := server.Stop(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// Останавливаем детекторы
	if promDetector != nil {
		promDetector.Stop()
	}

	log.Println("Shutdown complete")
}

// initActionHandlers инициализирует обработчики действий для оркестратора
func initActionHandlers(orch *orchestrator.Orchestrator, scriptsDir, kubeconfigPath, slackWebhook string) {
	// Обработчик для скриптов
	scriptHandler := orchestrator.NewScriptHandler(scriptsDir)
	orch.RegisterHandler(scriptHandler)

	// Обработчик для Kubernetes
	if kubeconfigPath != "" {
		k8sHandler, err := orchestrator.NewKubernetesHandlerWithKubeconfig(kubeconfigPath)
		if err != nil {
			log.Printf("Warning: Failed to initialize Kubernetes handler: %v", err)
		} else {
			orch.RegisterHandler(k8sHandler)
		}
	} else {
		k8sHandler, err := orchestrator.NewKubernetesHandlerInCluster()
		if err != nil {
			log.Printf("Warning: Failed to initialize Kubernetes handler: %v", err)
		} else {
			orch.RegisterHandler(k8sHandler)
		}
	}

	// Обработчик уведомлений
	notifHandler := orchestrator.NewNotificationHandler()
	if slackWebhook != "" {
		notifHandler.SetDefaultSlackWebhook(slackWebhook)
	}
	orch.RegisterHandler(notifHandler)
}

// initPrometheusDetector инициализирует детектор аномалий для Prometheus
func initPrometheusDetector(ctx context.Context, promURL string, orch *orchestrator.Orchestrator) (*detector.PrometheusAnomalyDetector, error) {
	collectInterval := 1 * time.Minute

	promDetector, err := detector.NewPrometheusAnomalyDetector(promURL, collectInterval)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Prometheus detector: %w", err)
	}

	// Регистрируем обработчик аномалий
	promDetector.RegisterAlertCallback(func(anomaly *detector.AnomalyEvent) error {
		log.Printf("Detected anomaly: %s, value: %f, score: %f",
			anomaly.MetricName, anomaly.Value, anomaly.Score)

		// Запускаем действия по устранению аномалии через оркестратор
		action := orchestrator.Action{
			Type: "notification",
			Parameters: map[string]string{
				"title":     "Prometheus Anomaly Alert",
				"message":   anomaly.Description,
				"level":     "warning",
				"source":    "prometheus",
				"metric":    anomaly.MetricName,
				"value":     fmt.Sprintf("%.2f", anomaly.Value),
				"score":     fmt.Sprintf("%.2f", anomaly.Score),
				"timestamp": anomaly.Timestamp.Format(time.RFC3339),
			},
		}

		_, err := orch.ExecuteAction(ctx, action)
		if err != nil {
			log.Printf("Failed to execute action for anomaly: %v", err)
		}

		return nil
	})

	// Запускаем детектор
	promDetector.Start(ctx)

	return promDetector, nil
}

// initLokiDetector инициализирует детектор аномалий для логов
func initLokiDetector(ctx context.Context, lokiURL, patternsPath string, orch *orchestrator.Orchestrator) (*detector.LogsAnomalyDetector, error) {
	// Загружаем шаблоны и настройки
	patterns, err := config.LoadLokiPatterns(patternsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load Loki patterns: %w", err)
	}

	// Создаем функцию обратного вызова для обработки логов
	logCallback := func(stream *types.LogStream) error {
		log.Printf("Received log stream with %d entries", len(stream.Entries))
		return nil
	}

	// Создаем коллектор логов
	collector, err := datasource.NewLokiCollector(lokiURL, 1*time.Minute, 5*time.Minute, logCallback)
	if err != nil {
		return nil, fmt.Errorf("failed to create Loki collector: %w", err)
	}

	// Создаем детектор аномалий
	logsDetector, err := detector.NewLogsAnomalyDetector(
		patterns.Thresholds.Errors.Warning,
		patterns.Thresholds.Warnings.Warning,
		time.Duration(patterns.Thresholds.TimeWindow)*time.Minute,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create logs detector: %w", err)
	}

	// Устанавливаем коллектор Loki
	logsDetector.SetLokiCollector(collector)

	// Регистрируем шаблоны
	for _, pattern := range patterns.Patterns {
		if err := logsDetector.AddPattern(pattern.Pattern, pattern.Severity, pattern.Description, pattern.Labels); err != nil {
			log.Printf("Failed to add pattern '%s': %v", pattern.Name, err)
		}
	}

	// Регистрируем запросы
	for _, query := range patterns.Queries {
		collector.AddQuery(query.Name, query.Query)
	}

	// Запускаем коллектор
	collector.Start(ctx)

	// Обрабатываем аномалии
	go func() {
		anomalyChan := logsDetector.GetAnomalyChan()
		for {
			select {
			case <-ctx.Done():
				return
			case anomaly := <-anomalyChan:
				handleLogAnomaly(ctx, anomaly, orch)
			}
		}
	}()

	return logsDetector, nil
}

// handleLogAnomaly обрабатывает аномалию в логах
func handleLogAnomaly(ctx context.Context, anomaly detector.Anomaly, orch *orchestrator.Orchestrator) {
	log.Printf("Detected log anomaly: %s (severity: %s, value: %.2f, threshold: %.2f)",
		anomaly.Type, anomaly.Severity, anomaly.Value, anomaly.Threshold)

	// Создаем действие для уведомления
	action := orchestrator.Action{
		Type: "notification",
		Parameters: map[string]string{
			"title":     "Log Anomaly Alert",
			"message":   fmt.Sprintf("Detected log anomaly: %s", anomaly.Type),
			"level":     anomaly.Severity,
			"source":    anomaly.Source,
			"type":      anomaly.Type,
			"value":     fmt.Sprintf("%.2f", anomaly.Value),
			"threshold": fmt.Sprintf("%.2f", anomaly.Threshold),
			"timestamp": anomaly.Timestamp.Format(time.RFC3339),
		},
	}

	_, err := orch.ExecuteAction(ctx, action)
	if err != nil {
		log.Printf("Failed to execute action for log anomaly: %v", err)
	}
}
