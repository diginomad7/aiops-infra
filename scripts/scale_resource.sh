#!/bin/bash
#
# Sample script for scaling a resource as part of AIOps remediation
# This script is meant to be called by the ScriptHandler

set -e

# Print script execution information
echo "=== AIOps Remediation Script: scale_resource.sh ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Target: $ACTION_PARAM_TARGET"

# Get parameters from environment variables set by the ScriptHandler
RESOURCE_TYPE=${ACTION_PARAM_RESOURCE_TYPE:-"unknown"}
RESOURCE_NAME=${ACTION_PARAM_RESOURCE_NAME:-"unknown"}
NAMESPACE=${ACTION_PARAM_NAMESPACE:-"default"}
REPLICAS=${ACTION_PARAM_REPLICAS:-"1"}
WAIT_FOR_READY=${ACTION_PARAM_WAIT_FOR_READY:-"true"}
TIMEOUT=${ACTION_PARAM_TIMEOUT:-"300"}

echo "Resource type: $RESOURCE_TYPE"
echo "Resource name: $RESOURCE_NAME"
echo "Namespace: $NAMESPACE"
echo "Target replicas: $REPLICAS"
echo "Wait for ready: $WAIT_FOR_READY"
echo "Timeout: $TIMEOUT seconds"

# Check if we have the required parameters
if [ "$RESOURCE_TYPE" = "unknown" ]; then
  echo "ERROR: Missing required parameter: resource_type"
  exit 1
fi

if [ "$RESOURCE_NAME" = "unknown" ]; then
  echo "ERROR: Missing required parameter: resource_name"
  exit 1
fi

# Function to simulate resource scaling
scale_resource() {
  local resource_type=$1
  local resource_name=$2
  local namespace=$3
  local replicas=$4
  
  echo "Scaling $resource_type $resource_name in namespace $namespace to $replicas replicas"
  
  # Simulate some work
  sleep 3
  
  # Randomly succeed or fail for demonstration purposes
  if [ $((RANDOM % 10)) -eq 0 ]; then
    echo "Failed to scale $resource_type $resource_name"
    return 1
  else
    echo "Successfully scaled $resource_type $resource_name to $replicas replicas"
    return 0
  fi
}

# Function to simulate waiting for resource to be ready
wait_for_ready() {
  local resource_type=$1
  local resource_name=$2
  local namespace=$3
  local timeout=$4
  
  echo "Waiting for $resource_type $resource_name to be ready (timeout: ${timeout}s)..."
  
  # Simulate waiting with progress dots
  local elapsed=0
  local interval=5
  
  while [ $elapsed -lt $timeout ]; do
    echo -n "."
    sleep $interval
    elapsed=$((elapsed + interval))
    
    # Randomly determine if ready
    if [ $((RANDOM % 4)) -eq 0 ]; then
      echo ""
      echo "$resource_type $resource_name is now ready"
      return 0
    fi
  done
  
  echo ""
  echo "Timeout reached while waiting for $resource_type $resource_name to be ready"
  return 1
}

# Scale the resource
if ! scale_resource "$RESOURCE_TYPE" "$RESOURCE_NAME" "$NAMESPACE" "$REPLICAS"; then
  echo "ERROR: Failed to scale resource"
  exit 1
fi

# Wait for readiness if requested
if [ "$WAIT_FOR_READY" = "true" ]; then
  if ! wait_for_ready "$RESOURCE_TYPE" "$RESOURCE_NAME" "$NAMESPACE" "$TIMEOUT"; then
    echo "WARNING: Resource was scaled but did not become ready within timeout"
    exit 0
  fi
fi

echo "Scale operation completed successfully"
exit 0 