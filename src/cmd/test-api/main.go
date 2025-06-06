package main

import (
	"log"

	"github.com/yourusername/aiops-infra/src/internal/api"
	"github.com/yourusername/aiops-infra/src/internal/orchestrator"
)

func main() {
	// Create orchestrator
	orch := orchestrator.NewOrchestrator()

	// Create API server
	server := api.NewServer(orch)

	// Start server
	log.Println("Starting test API server on :8080")
	log.Println("API endpoints available:")
	log.Println("  GET  /api/detectors - List all detectors")
	log.Println("  POST /api/detectors - Create new detector")
	log.Println("  GET  /api/detectors/{id} - Get specific detector")
	log.Println("  PUT  /api/detectors/{id} - Update detector")
	log.Println("  DELETE /api/detectors/{id} - Delete detector")
	log.Println("  POST /api/detectors/{id}/start - Start detector")
	log.Println("  POST /api/detectors/{id}/stop - Stop detector")
	log.Println("  GET  /api/detectors/{id}/status - Get detector status")
	log.Println("  GET  /api/detectors/{id}/health - Get detector health")
	log.Println("  POST /api/detectors/{id}/detect - Run detection")
	log.Println("  POST /api/detectors/{id}/train - Train detector")
	log.Println()

	if err := server.Start(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
