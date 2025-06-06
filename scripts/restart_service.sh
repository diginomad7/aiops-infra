#!/bin/bash
#
# Sample script for restarting a service as part of AIOps remediation
# This script is meant to be called by the ScriptHandler

set -e

# Print script execution information
echo "=== AIOps Remediation Script: restart_service.sh ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Target: $ACTION_PARAM_TARGET"

# Get parameters from environment variables set by the ScriptHandler
SERVICE_NAME=${ACTION_PARAM_SERVICE_NAME:-"unknown"}
RETRY_COUNT=${ACTION_PARAM_RETRY_COUNT:-3}
RETRY_DELAY=${ACTION_PARAM_RETRY_DELAY:-5}

echo "Service: $SERVICE_NAME"
echo "Retry count: $RETRY_COUNT"
echo "Retry delay: $RETRY_DELAY seconds"

# Check if we have the required parameters
if [ "$SERVICE_NAME" = "unknown" ]; then
  echo "ERROR: Missing required parameter: service_name"
  exit 1
fi

# Function to simulate service restart
restart_service() {
  local service_name=$1
  
  echo "Attempting to restart service: $service_name"
  
  # Simulate some work with a random outcome
  sleep 2
  
  # Randomly succeed or fail for demonstration purposes
  if [ $((RANDOM % 4)) -eq 0 ]; then
    echo "Failed to restart service $service_name"
    return 1
  else
    echo "Successfully restarted service $service_name"
    return 0
  fi
}

# Try to restart the service with retries
attempt=1
while [ $attempt -le $RETRY_COUNT ]; do
  echo "Attempt $attempt of $RETRY_COUNT:"
  
  if restart_service "$SERVICE_NAME"; then
    echo "Service restart successful on attempt $attempt"
    exit 0
  else
    echo "Service restart failed on attempt $attempt"
    
    if [ $attempt -lt $RETRY_COUNT ]; then
      echo "Waiting $RETRY_DELAY seconds before retry..."
      sleep $RETRY_DELAY
    fi
  fi
  
  attempt=$((attempt + 1))
done

echo "ERROR: All attempts to restart service $SERVICE_NAME have failed"
exit 1 