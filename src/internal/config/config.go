package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config представляет общую конфигурацию приложения
type Config struct {
	API        APIConfig        `yaml:"api"`
	Prometheus PrometheusConfig `yaml:"prometheus"`
	Loki       LokiConfig       `yaml:"loki"`
	Kubernetes KubernetesConfig `yaml:"kubernetes"`
	Slack      SlackConfig      `yaml:"slack"`
	Email      EmailConfig      `yaml:"email"`
}

// APIConfig содержит настройки API сервера
type APIConfig struct {
	Port int    `yaml:"port"`
	Host string `yaml:"host"`
}

// PrometheusConfig содержит настройки для подключения к Prometheus
type PrometheusConfig struct {
	URL     string `yaml:"url"`
	Enabled bool   `yaml:"enabled"`
}

// LokiConfig содержит настройки для подключения к Loki
type LokiConfig struct {
	URL     string `yaml:"url"`
	Enabled bool   `yaml:"enabled"`
}

// KubernetesConfig содержит настройки для подключения к Kubernetes
type KubernetesConfig struct {
	InCluster      bool   `yaml:"inCluster"`
	KubeConfigPath string `yaml:"kubeConfigPath"`
}

// SlackConfig содержит настройки для отправки уведомлений в Slack
type SlackConfig struct {
	WebhookURL string `yaml:"webhookUrl"`
	Channel    string `yaml:"channel"`
	Username   string `yaml:"username"`
}

// EmailConfig содержит настройки для отправки уведомлений по электронной почте
type EmailConfig struct {
	SMTPServer   string   `yaml:"smtpServer"`
	SMTPPort     int      `yaml:"smtpPort"`
	Username     string   `yaml:"username"`
	Password     string   `yaml:"password"`
	From         string   `yaml:"from"`
	To           []string `yaml:"to"`
	EnableTLS    bool     `yaml:"enableTLS"`
	TemplatePath string   `yaml:"templatePath"`
}

// LokiPatterns представляет конфигурацию шаблонов Loki для обнаружения аномалий
type LokiPatterns struct {
	Patterns []struct {
		Name        string   `yaml:"name"`
		Pattern     string   `yaml:"pattern"`
		Severity    string   `yaml:"severity"`
		Description string   `yaml:"description"`
		Labels      []string `yaml:"labels"`
	} `yaml:"patterns"`
	Queries []struct {
		Name  string `yaml:"name"`
		Query string `yaml:"query"`
	} `yaml:"queries"`
	Thresholds struct {
		Errors struct {
			Critical int `yaml:"critical"`
			Warning  int `yaml:"warning"`
		} `yaml:"errors"`
		Warnings struct {
			Critical int `yaml:"critical"`
			Warning  int `yaml:"warning"`
		} `yaml:"warnings"`
		TimeWindow int `yaml:"timeWindow"`
	} `yaml:"thresholds"`
}

// LoadConfig загружает конфигурацию из файла
func LoadConfig(configPath string) (*Config, error) {
	// Чтение файла конфигурации
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения файла конфигурации: %w", err)
	}

	// Создание экземпляра конфигурации
	config := &Config{}

	// Декодирование YAML
	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("ошибка парсинга файла конфигурации: %w", err)
	}

	// Установка значений по умолчанию
	setDefaults(config)

	// Проверка необходимых полей
	if err := validateConfig(config); err != nil {
		return nil, err
	}

	return config, nil
}

// LoadLokiPatterns загружает конфигурацию шаблонов Loki из файла
func LoadLokiPatterns(patternsPath string) (*LokiPatterns, error) {
	// Чтение файла конфигурации
	data, err := os.ReadFile(patternsPath)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения файла шаблонов Loki: %w", err)
	}

	// Создание экземпляра конфигурации
	patterns := &LokiPatterns{}

	// Декодирование YAML
	if err := yaml.Unmarshal(data, patterns); err != nil {
		return nil, fmt.Errorf("ошибка парсинга файла шаблонов Loki: %w", err)
	}

	// Установка значений по умолчанию
	setLokiPatternsDefaults(patterns)

	return patterns, nil
}

// setLokiPatternsDefaults устанавливает значения по умолчанию для шаблонов Loki
func setLokiPatternsDefaults(patterns *LokiPatterns) {
	// Пороги ошибок по умолчанию
	if patterns.Thresholds.Errors.Warning == 0 {
		patterns.Thresholds.Errors.Warning = 5
	}
	if patterns.Thresholds.Errors.Critical == 0 {
		patterns.Thresholds.Errors.Critical = 10
	}

	// Пороги предупреждений по умолчанию
	if patterns.Thresholds.Warnings.Warning == 0 {
		patterns.Thresholds.Warnings.Warning = 10
	}
	if patterns.Thresholds.Warnings.Critical == 0 {
		patterns.Thresholds.Warnings.Critical = 20
	}

	// Временное окно по умолчанию
	if patterns.Thresholds.TimeWindow == 0 {
		patterns.Thresholds.TimeWindow = 5 // 5 минут
	}
}

// setDefaults устанавливает значения по умолчанию для конфигурации
func setDefaults(config *Config) {
	// API настройки по умолчанию
	if config.API.Port == 0 {
		config.API.Port = 8080
	}
	if config.API.Host == "" {
		config.API.Host = "0.0.0.0"
	}

	// Prometheus настройки по умолчанию
	if config.Prometheus.URL == "" {
		config.Prometheus.URL = "http://prometheus:9090"
	}
	// По умолчанию Prometheus включен
	config.Prometheus.Enabled = true

	// Loki настройки по умолчанию
	if config.Loki.URL == "" {
		config.Loki.URL = "http://loki:3100"
	}
	// По умолчанию Loki включен
	config.Loki.Enabled = true

	// Kubernetes настройки по умолчанию
	if !config.Kubernetes.InCluster && config.Kubernetes.KubeConfigPath == "" {
		home := os.Getenv("HOME")
		config.Kubernetes.KubeConfigPath = fmt.Sprintf("%s/.kube/config", home)
	}
}

// validateConfig проверяет корректность конфигурации
func validateConfig(config *Config) error {
	// Проверка настроек API
	if config.API.Port < 0 || config.API.Port > 65535 {
		return fmt.Errorf("некорректный порт API: %d", config.API.Port)
	}

	// Проверка настроек Slack
	if config.Slack.WebhookURL != "" && config.Slack.Channel == "" {
		return fmt.Errorf("не указан канал Slack при наличии webhook URL")
	}

	// Проверка настроек Email
	if len(config.Email.To) > 0 {
		if config.Email.SMTPServer == "" {
			return fmt.Errorf("не указан SMTP сервер для отправки email")
		}
		if config.Email.SMTPPort <= 0 {
			return fmt.Errorf("некорректный порт SMTP: %d", config.Email.SMTPPort)
		}
		if config.Email.From == "" {
			return fmt.Errorf("не указан отправитель email")
		}
	}

	return nil
}

// SaveConfig сохраняет конфигурацию в файл
func SaveConfig(config *Config, configPath string) error {
	// Кодирование в YAML
	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("ошибка маршалинга конфигурации: %w", err)
	}

	// Запись в файл
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("ошибка записи файла конфигурации: %w", err)
	}

	return nil
}

// SaveLokiPatterns сохраняет конфигурацию шаблонов Loki в файл
func SaveLokiPatterns(patterns *LokiPatterns, patternsPath string) error {
	// Кодирование в YAML
	data, err := yaml.Marshal(patterns)
	if err != nil {
		return fmt.Errorf("ошибка маршалинга шаблонов Loki: %w", err)
	}

	// Запись в файл
	if err := os.WriteFile(patternsPath, data, 0644); err != nil {
		return fmt.Errorf("ошибка записи файла шаблонов Loki: %w", err)
	}

	return nil
}
