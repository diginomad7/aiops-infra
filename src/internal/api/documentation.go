package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// APIDocumentation represents the API documentation structure
type APIDocumentation struct {
	Info       APIInfo            `json:"info"`
	Servers    []APIServer        `json:"servers"`
	Paths      map[string]APIPath `json:"paths"`
	Components APIComponents      `json:"components"`
}

// APIInfo contains basic API information
type APIInfo struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Version     string     `json:"version"`
	Contact     APIContact `json:"contact"`
	License     APILicense `json:"license"`
}

// APIContact contains contact information
type APIContact struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	URL   string `json:"url"`
}

// APILicense contains license information
type APILicense struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// APIServer represents a server configuration
type APIServer struct {
	URL         string `json:"url"`
	Description string `json:"description"`
}

// APIPath represents API endpoint documentation
type APIPath struct {
	Summary     string               `json:"summary"`
	Description string               `json:"description"`
	Methods     map[string]APIMethod `json:"methods"`
}

// APIMethod represents HTTP method documentation
type APIMethod struct {
	Summary     string                 `json:"summary"`
	Description string                 `json:"description"`
	Parameters  []APIParameter         `json:"parameters,omitempty"`
	RequestBody *APIRequestBody        `json:"requestBody,omitempty"`
	Responses   map[string]APIResponse `json:"responses"`
	Tags        []string               `json:"tags,omitempty"`
}

// APIParameter represents API parameter documentation
type APIParameter struct {
	Name        string      `json:"name"`
	In          string      `json:"in"` // query, path, header
	Description string      `json:"description"`
	Required    bool        `json:"required"`
	Schema      APISchema   `json:"schema"`
	Example     interface{} `json:"example,omitempty"`
}

// APIRequestBody represents request body documentation
type APIRequestBody struct {
	Description string                `json:"description"`
	Required    bool                  `json:"required"`
	Content     map[string]APIContent `json:"content"`
}

// APIResponse represents response documentation
type APIResponse struct {
	Description string                `json:"description"`
	Content     map[string]APIContent `json:"content,omitempty"`
}

// APIContent represents content type documentation
type APIContent struct {
	Schema  APISchema   `json:"schema"`
	Example interface{} `json:"example,omitempty"`
}

// APISchema represents data schema documentation
type APISchema struct {
	Type        string               `json:"type"`
	Properties  map[string]APISchema `json:"properties,omitempty"`
	Items       *APISchema           `json:"items,omitempty"`
	Required    []string             `json:"required,omitempty"`
	Example     interface{}          `json:"example,omitempty"`
	Description string               `json:"description,omitempty"`
}

// APIComponents contains reusable components
type APIComponents struct {
	Schemas map[string]APISchema `json:"schemas"`
}

// GetAPIDocumentation returns the complete API documentation
func GetAPIDocumentation() APIDocumentation {
	return APIDocumentation{
		Info: APIInfo{
			Title:       "AIOps Infrastructure API",
			Description: "Real-time anomaly detection and monitoring system with ML-powered insights",
			Version:     "2.0.0",
			Contact: APIContact{
				Name:  "AIOps Team",
				Email: "support@aiops.dev",
				URL:   "https://github.com/aiops/infrastructure",
			},
			License: APILicense{
				Name: "MIT",
				URL:  "https://opensource.org/licenses/MIT",
			},
		},
		Servers: []APIServer{
			{
				URL:         "http://localhost:8080",
				Description: "Development server",
			},
			{
				URL:         "https://api.aiops.prod",
				Description: "Production server",
			},
		},
		Paths:      getAPIPaths(),
		Components: getAPIComponents(),
	}
}

// getAPIPaths returns all API paths documentation
func getAPIPaths() map[string]APIPath {
	return map[string]APIPath{
		"/api/v1/detectors": {
			Summary:     "Detector Management",
			Description: "CRUD operations for anomaly detectors",
			Methods: map[string]APIMethod{
				"GET": {
					Summary:     "List all detectors",
					Description: "Retrieve a list of all configured anomaly detectors",
					Responses: map[string]APIResponse{
						"200": {
							Description: "Successful response",
							Content: map[string]APIContent{
								"application/json": {
									Schema: APISchema{
										Type: "array",
										Items: &APISchema{
											Type: "object",
											Properties: map[string]APISchema{
												"id":     {Type: "string", Description: "Detector ID"},
												"name":   {Type: "string", Description: "Detector name"},
												"type":   {Type: "string", Description: "Detector type"},
												"status": {Type: "string", Description: "Current status"},
											},
										},
									},
								},
							},
						},
					},
					Tags: []string{"detectors"},
				},
				"POST": {
					Summary:     "Create new detector",
					Description: "Create a new anomaly detector configuration",
					RequestBody: &APIRequestBody{
						Description: "Detector configuration",
						Required:    true,
						Content: map[string]APIContent{
							"application/json": {
								Schema: APISchema{
									Type: "object",
									Properties: map[string]APISchema{
										"name":   {Type: "string", Description: "Detector name"},
										"type":   {Type: "string", Description: "Detector type"},
										"config": {Type: "object", Description: "Detector configuration"},
									},
									Required: []string{"name", "type"},
								},
							},
						},
					},
					Responses: map[string]APIResponse{
						"201": {
							Description: "Detector created successfully",
						},
						"400": {
							Description: "Invalid request",
						},
					},
					Tags: []string{"detectors"},
				},
			},
		},
		"/health": {
			Summary:     "System Health Check",
			Description: "Get overall system health status",
			Methods: map[string]APIMethod{
				"GET": {
					Summary:     "Health check",
					Description: "Retrieve comprehensive system health information",
					Responses: map[string]APIResponse{
						"200": {
							Description: "System is healthy",
						},
						"503": {
							Description: "System is unhealthy",
						},
					},
					Tags: []string{"monitoring"},
				},
			},
		},
		"/ws": {
			Summary:     "WebSocket Connection",
			Description: "Real-time WebSocket endpoint for live updates",
			Methods: map[string]APIMethod{
				"GET": {
					Summary:     "WebSocket upgrade",
					Description: "Upgrade HTTP connection to WebSocket for real-time communication",
					Tags:        []string{"websocket", "realtime"},
				},
			},
		},
	}
}

// getAPIComponents returns reusable API components
func getAPIComponents() APIComponents {
	return APIComponents{
		Schemas: map[string]APISchema{
			"Detector": {
				Type: "object",
				Properties: map[string]APISchema{
					"id": {
						Type:        "string",
						Description: "Unique detector identifier",
						Example:     "detector-123",
					},
					"name": {
						Type:        "string",
						Description: "Human-readable detector name",
						Example:     "CPU Anomaly Detector",
					},
					"type": {
						Type:        "string",
						Description: "Type of anomaly detection algorithm",
						Example:     "statistical_mad",
					},
					"status": {
						Type:        "string",
						Description: "Current detector status",
						Example:     "running",
					},
				},
				Required: []string{"id", "name", "type", "status"},
			},
			"Error": {
				Type: "object",
				Properties: map[string]APISchema{
					"code": {
						Type:        "string",
						Description: "Error code",
						Example:     "VALIDATION_ERROR",
					},
					"message": {
						Type:        "string",
						Description: "Error message",
						Example:     "Invalid request parameters",
					},
					"timestamp": {
						Type:        "string",
						Description: "Error timestamp (ISO 8601)",
						Example:     "2024-12-28T10:00:00Z",
					},
				},
				Required: []string{"code", "message", "timestamp"},
			},
		},
	}
}

// DocumentationHandler serves the API documentation
func DocumentationHandler(c *gin.Context) {
	docs := GetAPIDocumentation()
	c.JSON(http.StatusOK, docs)
}

// SwaggerUIHandler serves a simple Swagger UI page
func SwaggerUIHandler(c *gin.Context) {
	html := generateSwaggerUI()
	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, html)
}

// generateSwaggerUI creates a simple HTML page with Swagger UI
func generateSwaggerUI() string {
	return `<!DOCTYPE html>
<html>
<head>
    <title>AIOps Infrastructure API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`
}

// DeploymentInfo contains deployment configuration information
type DeploymentInfo struct {
	Environment   string            `json:"environment"`
	Version       string            `json:"version"`
	BuildTime     string            `json:"build_time"`
	Configuration map[string]string `json:"configuration"`
	Health        string            `json:"health_endpoint"`
	Metrics       string            `json:"metrics_endpoint"`
	Documentation string            `json:"documentation_endpoint"`
}

// DeploymentInfoHandler returns deployment information
func DeploymentInfoHandler(c *gin.Context) {
	info := DeploymentInfo{
		Environment: "development",
		Version:     "2.0.0",
		BuildTime:   time.Now().Format(time.RFC3339),
		Configuration: map[string]string{
			"log_level":         "info",
			"prometheus_url":    "http://localhost:9090",
			"loki_url":          "http://localhost:3100",
			"cache_enabled":     "true",
			"websocket_enabled": "true",
		},
		Health:        "/health",
		Metrics:       "/metrics",
		Documentation: "/api/docs",
	}

	c.JSON(http.StatusOK, info)
}
