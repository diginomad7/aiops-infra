package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/yourusername/aiops-infra/src/internal/orchestrator"
)

// ActionRequest represents a request to execute a remediation action
type ActionRequest struct {
	Type        string            `json:"type"`
	Target      string            `json:"target"`
	Parameters  map[string]string `json:"parameters,omitempty"`
	Timeout     string            `json:"timeout,omitempty"`
	RetryPolicy *struct {
		MaxRetries    int     `json:"max_retries"`
		RetryInterval string  `json:"retry_interval"`
		MaxInterval   string  `json:"max_interval,omitempty"`
		Multiplier    float64 `json:"multiplier,omitempty"`
	} `json:"retry_policy,omitempty"`
	DependsOn []string `json:"depends_on,omitempty"`
}

// ActionResponse represents the response to an action execution request
type ActionResponse struct {
	Status  string                     `json:"status"`
	Message string                     `json:"message,omitempty"`
	Action  *orchestrator.Action       `json:"action,omitempty"`
	Result  *orchestrator.ActionResult `json:"result,omitempty"`
}

// OrchestratorHandler handles API requests for the orchestrator
type OrchestratorHandler struct {
	orchestrator *orchestrator.Orchestrator
}

// NewOrchestratorHandler creates a new orchestrator handler
func NewOrchestratorHandler(orch *orchestrator.Orchestrator) *OrchestratorHandler {
	return &OrchestratorHandler{
		orchestrator: orch,
	}
}

// ServeHTTP handles HTTP requests for the orchestrator API
func (h *OrchestratorHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Parse the path to determine the action
	path := strings.TrimPrefix(r.URL.Path, "/api/orchestrator")

	switch {
	case path == "" || path == "/":
		// List all actions or execute an action plan
		if r.Method == http.MethodGet {
			h.listActions(w, r)
		} else if r.Method == http.MethodPost {
			h.executeActionPlan(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}

	case strings.HasPrefix(path, "/action"):
		// Handle individual action
		actionPath := strings.TrimPrefix(path, "/action")

		if actionPath == "" || actionPath == "/" {
			// Execute a single action
			if r.Method == http.MethodPost {
				h.executeAction(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			// Get action by target
			target := strings.TrimPrefix(actionPath, "/")
			if r.Method == http.MethodGet {
				h.getAction(w, r, target)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}

	default:
		http.NotFound(w, r)
	}
}

// listActions returns a list of all actions
func (h *OrchestratorHandler) listActions(w http.ResponseWriter, r *http.Request) {
	actions := h.orchestrator.ListActions()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"message": fmt.Sprintf("Found %d actions", len(actions)),
		"actions": actions,
	})
}

// getAction returns information about a specific action
func (h *OrchestratorHandler) getAction(w http.ResponseWriter, r *http.Request, target string) {
	action, exists := h.orchestrator.GetAction(target)
	if !exists {
		http.Error(w, fmt.Sprintf("Action with target '%s' not found", target), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"action": action,
	})
}

// executeAction executes a single remediation action
func (h *OrchestratorHandler) executeAction(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Type == "" {
		http.Error(w, "Action type is required", http.StatusBadRequest)
		return
	}

	if req.Target == "" {
		http.Error(w, "Action target is required", http.StatusBadRequest)
		return
	}

	// Convert action type
	var actionType orchestrator.ActionType
	switch req.Type {
	case "restart":
		actionType = orchestrator.ActionRestart
	case "scale":
		actionType = orchestrator.ActionScale
	case "notify":
		actionType = orchestrator.ActionNotify
	case "exec_script":
		actionType = orchestrator.ActionExecScript
	default:
		http.Error(w, fmt.Sprintf("Unsupported action type: %s", req.Type), http.StatusBadRequest)
		return
	}

	// Parse timeout if provided
	var timeout time.Duration
	if req.Timeout != "" {
		var err error
		timeout, err = time.ParseDuration(req.Timeout)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid timeout format: %v", err), http.StatusBadRequest)
			return
		}
	}

	// Create retry policy if provided
	var retryPolicy *orchestrator.RetryPolicy
	if req.RetryPolicy != nil {
		retryInterval, err := time.ParseDuration(req.RetryPolicy.RetryInterval)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid retry interval format: %v", err), http.StatusBadRequest)
			return
		}

		var maxInterval time.Duration
		if req.RetryPolicy.MaxInterval != "" {
			maxInterval, err = time.ParseDuration(req.RetryPolicy.MaxInterval)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid max interval format: %v", err), http.StatusBadRequest)
				return
			}
		}

		retryPolicy = &orchestrator.RetryPolicy{
			MaxRetries:    req.RetryPolicy.MaxRetries,
			RetryInterval: retryInterval,
			MaxInterval:   maxInterval,
			Multiplier:    req.RetryPolicy.Multiplier,
		}
	}

	// Create action
	action := orchestrator.Action{
		Type:        actionType,
		Target:      req.Target,
		Parameters:  req.Parameters,
		Timeout:     timeout,
		RetryPolicy: retryPolicy,
		DependsOn:   req.DependsOn,
		Status:      orchestrator.StatusPending,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Execute action
	result, err := h.orchestrator.ExecuteAction(r.Context(), action)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to execute action: %v", err), http.StatusInternalServerError)
		return
	}

	// Get updated action
	updatedAction, _ := h.orchestrator.GetAction(req.Target)

	// Return response
	response := ActionResponse{
		Status:  "ok",
		Message: "Action executed successfully",
		Action:  &updatedAction,
		Result:  result,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// executeActionPlan executes a sequence of actions with dependencies
func (h *OrchestratorHandler) executeActionPlan(w http.ResponseWriter, r *http.Request) {
	var reqList []ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&reqList); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if len(reqList) == 0 {
		http.Error(w, "Empty action plan", http.StatusBadRequest)
		return
	}

	// Convert requests to actions
	actions := make([]orchestrator.Action, 0, len(reqList))

	for _, req := range reqList {
		// Convert action type
		var actionType orchestrator.ActionType
		switch req.Type {
		case "restart":
			actionType = orchestrator.ActionRestart
		case "scale":
			actionType = orchestrator.ActionScale
		case "notify":
			actionType = orchestrator.ActionNotify
		case "exec_script":
			actionType = orchestrator.ActionExecScript
		default:
			http.Error(w, fmt.Sprintf("Unsupported action type: %s", req.Type), http.StatusBadRequest)
			return
		}

		// Parse timeout if provided
		var timeout time.Duration
		if req.Timeout != "" {
			var err error
			timeout, err = time.ParseDuration(req.Timeout)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid timeout format for action %s: %v", req.Target, err), http.StatusBadRequest)
				return
			}
		}

		// Create retry policy if provided
		var retryPolicy *orchestrator.RetryPolicy
		if req.RetryPolicy != nil {
			retryInterval, err := time.ParseDuration(req.RetryPolicy.RetryInterval)
			if err != nil {
				http.Error(w, fmt.Sprintf("Invalid retry interval format for action %s: %v", req.Target, err), http.StatusBadRequest)
				return
			}

			var maxInterval time.Duration
			if req.RetryPolicy.MaxInterval != "" {
				maxInterval, err = time.ParseDuration(req.RetryPolicy.MaxInterval)
				if err != nil {
					http.Error(w, fmt.Sprintf("Invalid max interval format for action %s: %v", req.Target, err), http.StatusBadRequest)
					return
				}
			}

			retryPolicy = &orchestrator.RetryPolicy{
				MaxRetries:    req.RetryPolicy.MaxRetries,
				RetryInterval: retryInterval,
				MaxInterval:   maxInterval,
				Multiplier:    req.RetryPolicy.Multiplier,
			}
		}

		// Create action
		action := orchestrator.Action{
			Type:        actionType,
			Target:      req.Target,
			Parameters:  req.Parameters,
			Timeout:     timeout,
			RetryPolicy: retryPolicy,
			DependsOn:   req.DependsOn,
			Status:      orchestrator.StatusPending,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		actions = append(actions, action)
	}

	// Execute action plan
	err := h.orchestrator.ExecuteActionPlan(r.Context(), actions)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to execute action plan: %v", err), http.StatusInternalServerError)
		return
	}

	// Get updated actions
	updatedActions := make([]orchestrator.Action, 0, len(actions))
	for _, action := range actions {
		if updatedAction, exists := h.orchestrator.GetAction(action.Target); exists {
			updatedActions = append(updatedActions, updatedAction)
		}
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"message": "Action plan executed successfully",
		"actions": updatedActions,
	})
}
