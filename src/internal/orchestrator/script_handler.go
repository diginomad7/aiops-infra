package orchestrator

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ScriptHandler handles the execution of scripts for remediation
type ScriptHandler struct {
	// ScriptsDir is the base directory for remediation scripts
	ScriptsDir string

	// AllowedExtensions defines which script extensions are allowed to run
	AllowedExtensions []string

	// Environment variables to pass to executed scripts
	Environment map[string]string
}

// NewScriptHandler creates a new script handler
func NewScriptHandler(scriptsDir string) *ScriptHandler {
	// Default allowed extensions
	allowedExtensions := []string{".sh", ".py", ".rb"}

	// Create scripts directory if it doesn't exist
	if _, err := os.Stat(scriptsDir); os.IsNotExist(err) {
		os.MkdirAll(scriptsDir, 0755)
	}

	return &ScriptHandler{
		ScriptsDir:        scriptsDir,
		AllowedExtensions: allowedExtensions,
		Environment:       make(map[string]string),
	}
}

// CanHandle returns true if this handler can handle the given action type
func (h *ScriptHandler) CanHandle(actionType ActionType) bool {
	return actionType == ActionExecScript
}

// SetEnvironment sets environment variables for script execution
func (h *ScriptHandler) SetEnvironment(env map[string]string) {
	h.Environment = env
}

// Execute performs the script execution action
func (h *ScriptHandler) Execute(ctx context.Context, action Action) (*ActionResult, error) {
	// Get script name from parameters
	scriptName := action.Parameters["script_name"]
	if scriptName == "" {
		return nil, fmt.Errorf("script_name parameter is required")
	}

	// Validate script extension
	ext := filepath.Ext(scriptName)
	validExt := false
	for _, allowed := range h.AllowedExtensions {
		if ext == allowed {
			validExt = true
			break
		}
	}

	if !validExt {
		return nil, fmt.Errorf("script extension %s is not allowed", ext)
	}

	// Build the script path
	scriptPath := filepath.Join(h.ScriptsDir, scriptName)

	// Check if script exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("script %s does not exist", scriptPath)
	}

	// Get script arguments
	args := []string{}
	if argsStr, ok := action.Parameters["args"]; ok && argsStr != "" {
		args = strings.Split(argsStr, " ")
	}

	// Get timeout for script execution
	timeout := action.Timeout
	if timeout == 0 {
		// Default timeout: 5 minutes
		timeout = 5 * time.Minute
	}

	// Create a timeout context if needed
	execCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// Prepare command execution
	var cmd *exec.Cmd
	switch ext {
	case ".sh":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(execCtx, "bash", cmdArgs...)
	case ".py":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(execCtx, "python3", cmdArgs...)
	case ".rb":
		cmdArgs := append([]string{scriptPath}, args...)
		cmd = exec.CommandContext(execCtx, "ruby", cmdArgs...)
	default:
		return nil, fmt.Errorf("unsupported script extension: %s", ext)
	}

	// Set working directory to script directory
	cmd.Dir = h.ScriptsDir

	// Set environment variables
	cmd.Env = os.Environ()
	for k, v := range h.Environment {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	// Add action parameters as environment variables with prefix ACTION_PARAM_
	for k, v := range action.Parameters {
		cmd.Env = append(cmd.Env, fmt.Sprintf("ACTION_PARAM_%s=%s", strings.ToUpper(k), v))
	}

	// Capture stdout and stderr
	outputBytes, err := cmd.CombinedOutput()
	output := string(outputBytes)

	if err != nil {
		return &ActionResult{
			Success:     false,
			Message:     fmt.Sprintf("Failed to execute script %s", scriptName),
			Details:     fmt.Sprintf("Error: %v\nOutput: %s", err, output),
			CompletedAt: time.Now(),
		}, fmt.Errorf("script execution failed: %w", err)
	}

	return &ActionResult{
		Success:     true,
		Message:     fmt.Sprintf("Successfully executed script %s", scriptName),
		Details:     output,
		CompletedAt: time.Now(),
	}, nil
}
