package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/api"
)

func TestAnomalyDetectorService(t *testing.T) {
	// Start the service in a goroutine
	go main()

	// Wait for the service to start
	time.Sleep(2 * time.Second)

	// Test health endpoint
	t.Run("health check", func(t *testing.T) {
		resp, err := http.Get("http://localhost:8080/health")
		if err != nil {
			t.Fatalf("Failed to call health endpoint: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status OK, got %v", resp.Status)
		}
	})

	// Test metrics endpoint
	t.Run("metrics endpoint", func(t *testing.T) {
		resp, err := http.Get("http://localhost:8080/metrics")
		if err != nil {
			t.Fatalf("Failed to call metrics endpoint: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status OK, got %v", resp.Status)
		}
	})

	// Test configuration update
	t.Run("config update", func(t *testing.T) {
		config := api.DetectorConfig{
			Mean:      75,
			StdDev:    12,
			Threshold: 2,
			DataType:  "cpu",
		}

		body, err := json.Marshal(config)
		if err != nil {
			t.Fatalf("Failed to marshal config: %v", err)
		}

		resp, err := http.Post(
			"http://localhost:8080/api/v1/config?name=cpu",
			"application/json",
			bytes.NewBuffer(body),
		)
		if err != nil {
			t.Fatalf("Failed to update config: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status OK, got %v", resp.Status)
		}
	})

	// Test invalid configuration update
	t.Run("invalid config update", func(t *testing.T) {
		config := api.DetectorConfig{
			Mean:      75,
			StdDev:    -12, // Negative StdDev should fail
			Threshold: 2,
			DataType:  "cpu",
		}

		body, err := json.Marshal(config)
		if err != nil {
			t.Fatalf("Failed to marshal config: %v", err)
		}

		resp, err := http.Post(
			"http://localhost:8080/api/v1/config?name=cpu",
			"application/json",
			bytes.NewBuffer(body),
		)
		if err != nil {
			t.Fatalf("Failed to call config endpoint: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status BadRequest, got %v", resp.Status)
		}
	})
}

func TestMain(m *testing.M) {
	// Create a context with timeout for all tests
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Run tests
	done := make(chan int, 1)
	go func() {
		done <- m.Run()
	}()

	// Wait for either context timeout or test completion
	select {
	case <-ctx.Done():
		fmt.Println("Tests timed out")
		os.Exit(1)
	case code := <-done:
		os.Exit(code)
	}
}
