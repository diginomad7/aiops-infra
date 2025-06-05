# Переменные
SHELL := /bin/bash
GO := go
GOFLAGS := -v
GOOS ?= linux
GOARCH ?= amd64
VERSION ?= $(shell git describe --tags --always --dirty)

# Директории
ROOT_DIR := $(shell pwd)
BIN_DIR := $(ROOT_DIR)/bin
SRC_DIR := $(ROOT_DIR)/src
TEST_DIR := $(ROOT_DIR)/tests

# Компоненты
COMPONENTS := analyzer orchestrator

# Цели для разработки
.PHONY: setup-dev
setup-dev: ## Установка dev-окружения
	@echo "==> Установка зависимостей для разработки..."
	$(GO) mod download
	$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	$(GO) install golang.org/x/tools/cmd/goimports@latest

.PHONY: lint
lint: ## Запуск линтеров
	@echo "==> Проверка кода линтером..."
	golangci-lint run ./...

.PHONY: fmt
fmt: ## Форматирование кода
	@echo "==> Форматирование кода..."
	goimports -w $(SRC_DIR)
	$(GO) fmt ./...

.PHONY: test
test: ## Запуск тестов
	@echo "==> Запуск unit-тестов..."
	$(GO) test -v ./...

.PHONY: test-integration
test-integration: ## Запуск интеграционных тестов
	@echo "==> Запуск интеграционных тестов..."
	$(GO) test -v -tags=integration ./tests/integration/...

.PHONY: build
build: ## Сборка всех компонентов
	@echo "==> Сборка компонентов..."
	@for component in $(COMPONENTS); do \
		echo "==> Сборка $$component..."; \
		GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build $(GOFLAGS) \
			-o $(BIN_DIR)/$$component \
			$(SRC_DIR)/cmd/$$component; \
	done

# Инфраструктура
.PHONY: infra-init
infra-init: ## Инициализация инфраструктуры
	@echo "==> Инициализация Terraform..."
	cd terraform && terraform init

.PHONY: infra-plan
infra-plan: ## План изменений инфраструктуры
	@echo "==> Планирование изменений..."
	cd terraform && terraform plan

.PHONY: infra-apply
infra-apply: ## Применение изменений инфраструктуры
	@echo "==> Применение изменений..."
	cd terraform && terraform apply -auto-approve

# Kubernetes
.PHONY: k8s-apply
k8s-apply: ## Применение K8s манифестов
	@echo "==> Применение Kubernetes манифестов..."
	kubectl apply -f kubernetes/monitoring/
	kubectl apply -f kubernetes/logging/
	kubectl apply -f kubernetes/ml-pipeline/
	kubectl apply -f kubernetes/orchestrator/

.PHONY: k8s-delete
k8s-delete: ## Удаление K8s ресурсов
	@echo "==> Удаление Kubernetes ресурсов..."
	kubectl delete -f kubernetes/orchestrator/
	kubectl delete -f kubernetes/ml-pipeline/
	kubectl delete -f kubernetes/logging/
	kubectl delete -f kubernetes/monitoring/

# Docker
.PHONY: docker-build
docker-build: ## Сборка Docker образов
	@echo "==> Сборка Docker образов..."
	@for component in $(COMPONENTS); do \
		echo "==> Сборка образа $$component..."; \
		docker build -t aiops/$$component:$(VERSION) \
			-f docker/$$component/Dockerfile .; \
	done

.PHONY: docker-push
docker-push: ## Публикация Docker образов
	@echo "==> Публикация Docker образов..."
	@for component in $(COMPONENTS); do \
		echo "==> Публикация образа $$component..."; \
		docker push aiops/$$component:$(VERSION); \
	done

# Локальная разработка
.PHONY: dev-up
dev-up: ## Запуск локального окружения
	@echo "==> Запуск локального окружения..."
	docker-compose up -d

.PHONY: dev-down
dev-down: ## Остановка локального окружения
	@echo "==> Остановка локального окружения..."
	docker-compose down

# Очистка
.PHONY: clean
clean: ## Очистка артефактов сборки
	@echo "==> Очистка..."
	rm -rf $(BIN_DIR)/*
	$(GO) clean -cache -testcache

# Помощь
.PHONY: help
help: ## Показать это сообщение
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help 