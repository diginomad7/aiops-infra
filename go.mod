module github.com/yourusername/aiops-infra

go 1.21

require (
	github.com/prometheus/client_golang v1.17.0
	github.com/grafana/loki-client-go v0.0.0-20230116142646-e7494d0ef70c
	go.opentelemetry.io/otel v1.19.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.19.0
	go.opentelemetry.io/otel/sdk v1.19.0
	k8s.io/client-go v0.28.3
	github.com/spf13/viper v1.17.0
	github.com/gin-gonic/gin v1.9.1
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	gopkg.in/yaml.v3 v3.0.1
) 