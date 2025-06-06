package orchestrator

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// ActionType defines the type of remediation action
type ActionType string

const (
	// ActionRestart restarts a service or component
	ActionRestart ActionType = "restart"
	// ActionScale scales a service up or down
	ActionScale ActionType = "scale"
	// ActionNotify sends a notification without taking action
	ActionNotify ActionType = "notify"
	// ActionExecScript executes a custom script
	ActionExecScript ActionType = "exec_script"
)

// Action represents a remediation action to be taken
type Action struct {
	Type        ActionType        `json:"type"`
	Target      string            `json:"target"`
	Parameters  map[string]string `json:"parameters,omitempty"`
	Timeout     time.Duration     `json:"timeout,omitempty"`
	RetryPolicy *RetryPolicy      `json:"retry_policy,omitempty"`
	DependsOn   []string          `json:"depends_on,omitempty"`
	Status      ActionStatus      `json:"status"`
	Result      *ActionResult     `json:"result,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// ActionStatus represents the status of an action
type ActionStatus string

const (
	// StatusPending action is pending execution
	StatusPending ActionStatus = "pending"
	// StatusRunning action is currently running
	StatusRunning ActionStatus = "running"
	// StatusSucceeded action completed successfully
	StatusSucceeded ActionStatus = "succeeded"
	// StatusFailed action failed
	StatusFailed ActionStatus = "failed"
	// StatusCancelled action was cancelled
	StatusCancelled ActionStatus = "cancelled"
)

// ActionResult contains the result of an executed action
type ActionResult struct {
	Success     bool      `json:"success"`
	Message     string    `json:"message,omitempty"`
	Details     string    `json:"details,omitempty"`
	CompletedAt time.Time `json:"completed_at"`
}

// RetryPolicy defines how to retry failed actions
type RetryPolicy struct {
	MaxRetries    int           `json:"max_retries"`
	RetryInterval time.Duration `json:"retry_interval"`
	MaxInterval   time.Duration `json:"max_interval,omitempty"`
	Multiplier    float64       `json:"multiplier,omitempty"`
}

// ActionHandler defines the interface for components that can execute actions
type ActionHandler interface {
	// Execute performs the action and returns the result
	Execute(ctx context.Context, action Action) (*ActionResult, error)
	// CanHandle returns true if this handler can handle the given action type
	CanHandle(actionType ActionType) bool
}

// Orchestrator coordinates the execution of remediation actions
type Orchestrator struct {
	mu       sync.RWMutex
	handlers map[ActionType]ActionHandler
	actions  map[string]Action
}

// NewOrchestrator creates a new orchestrator instance
func NewOrchestrator() *Orchestrator {
	return &Orchestrator{
		handlers: make(map[ActionType]ActionHandler),
		actions:  make(map[string]Action),
	}
}

// RegisterHandler registers an action handler for a specific action type
func (o *Orchestrator) RegisterHandler(handler ActionHandler) {
	o.mu.Lock()
	defer o.mu.Unlock()

	for _, actionType := range []ActionType{ActionRestart, ActionScale, ActionNotify, ActionExecScript} {
		if handler.CanHandle(actionType) {
			o.handlers[actionType] = handler
		}
	}
}

// ExecuteAction executes a remediation action
func (o *Orchestrator) ExecuteAction(ctx context.Context, action Action) (*ActionResult, error) {
	o.mu.Lock()
	handler, exists := o.handlers[action.Type]
	o.mu.Unlock()

	if !exists {
		return nil, fmt.Errorf("no handler registered for action type: %s", action.Type)
	}

	// Set initial action state
	action.Status = StatusRunning
	action.CreatedAt = time.Now()
	action.UpdatedAt = time.Now()

	o.updateAction(action)

	// Create a timeout context if needed
	execCtx := ctx
	if action.Timeout > 0 {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, action.Timeout)
		defer cancel()
	}

	result, err := handler.Execute(execCtx, action)

	// Update action with result
	action.UpdatedAt = time.Now()
	if err != nil {
		action.Status = StatusFailed
		action.Result = &ActionResult{
			Success:     false,
			Message:     err.Error(),
			CompletedAt: time.Now(),
		}
	} else {
		action.Status = StatusSucceeded
		action.Result = result
	}

	o.updateAction(action)

	return result, err
}

// ExecuteActionPlan executes a sequence of actions with dependency handling
func (o *Orchestrator) ExecuteActionPlan(ctx context.Context, actions []Action) error {
	if len(actions) == 0 {
		return errors.New("empty action plan")
	}

	// Build dependency graph
	dependencyGraph := make(map[string][]string)
	actionMap := make(map[string]Action)

	for _, action := range actions {
		actionID := action.Target
		actionMap[actionID] = action
		dependencyGraph[actionID] = action.DependsOn
	}

	// Execute actions in dependency order
	executed := make(map[string]bool)

	var executeWithDeps func(string) error
	executeWithDeps = func(actionID string) error {
		// Skip if already executed
		if executed[actionID] {
			return nil
		}

		// Check if action exists
		action, exists := actionMap[actionID]
		if !exists {
			return fmt.Errorf("action not found: %s", actionID)
		}

		// Execute dependencies first
		for _, depID := range dependencyGraph[actionID] {
			if err := executeWithDeps(depID); err != nil {
				return err
			}
		}

		// Execute the action
		_, err := o.ExecuteAction(ctx, action)
		if err != nil {
			return fmt.Errorf("failed to execute action %s: %w", actionID, err)
		}

		executed[actionID] = true
		return nil
	}

	// Execute all actions
	for actionID := range actionMap {
		if err := executeWithDeps(actionID); err != nil {
			return err
		}
	}

	return nil
}

// GetAction retrieves an action by its target identifier
func (o *Orchestrator) GetAction(target string) (Action, bool) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	action, exists := o.actions[target]
	return action, exists
}

// ListActions returns all actions
func (o *Orchestrator) ListActions() []Action {
	o.mu.RLock()
	defer o.mu.RUnlock()

	actions := make([]Action, 0, len(o.actions))
	for _, action := range o.actions {
		actions = append(actions, action)
	}

	return actions
}

// updateAction updates or adds an action in the internal store
func (o *Orchestrator) updateAction(action Action) {
	o.mu.Lock()
	defer o.mu.Unlock()

	o.actions[action.Target] = action
}
