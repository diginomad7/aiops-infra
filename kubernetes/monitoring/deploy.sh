#!/bin/bash

# Ensure script fails on any error
set -e

echo "Deploying monitoring stack..."

# Create monitoring namespace if it doesn't exist
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMaps
echo "Applying ConfigMaps..."
kubectl apply -f loki-config.yaml
kubectl apply -f loki-rules-configmap.yaml
kubectl apply -f grafana-datasources.yaml
kubectl apply -f grafana-dashboards-configmap.yaml
kubectl apply -f promtail-config.yaml
kubectl apply -f otel-collector-config.yaml
kubectl apply -f tempo-config.yaml
kubectl apply -f ml-metrics-rules.yaml

# Apply core components
echo "Deploying core monitoring components..."
kubectl apply -f prometheus-deployment.yaml
kubectl apply -f alertmanager-deployment.yaml
kubectl apply -f grafana-deployment.yaml

# Deploy logging components
echo "Deploying logging components..."
kubectl apply -f loki-deployment.yaml
kubectl apply -f promtail-daemonset.yaml

# Deploy tracing components
echo "Deploying tracing components..."
kubectl apply -f otel-collector-deployment.yaml
kubectl apply -f tempo-deployment.yaml

# Wait for deployments
echo "Waiting for deployments to be ready..."
kubectl -n monitoring wait --for=condition=available --timeout=300s deployment/prometheus
kubectl -n monitoring wait --for=condition=available --timeout=300s deployment/alertmanager
kubectl -n monitoring wait --for=condition=available --timeout=300s deployment/grafana
kubectl -n monitoring wait --for=condition=available --timeout=300s deployment/otel-collector
kubectl -n monitoring wait --for=condition=ready --timeout=300s statefulset/loki
kubectl -n monitoring wait --for=condition=ready --timeout=300s statefulset/tempo

# Check DaemonSet status
echo "Checking DaemonSet status..."
DESIRED=$(kubectl -n monitoring get daemonset promtail -o jsonpath='{.status.desiredNumberScheduled}')
CURRENT=$(kubectl -n monitoring get daemonset promtail -o jsonpath='{.status.currentNumberScheduled}')
READY=$(kubectl -n monitoring get daemonset promtail -o jsonpath='{.status.numberReady}')

if [ "$DESIRED" == "$CURRENT" ] && [ "$CURRENT" == "$READY" ]; then
    echo "Promtail DaemonSet is ready"
else
    echo "Warning: Promtail DaemonSet is not fully ready. Desired: $DESIRED, Current: $CURRENT, Ready: $READY"
fi

# Setup port-forwarding for accessing UIs
echo "Setting up port forwarding..."
kubectl -n monitoring port-forward deployment/grafana 3000:3000 &
kubectl -n monitoring port-forward deployment/prometheus 9090:9090 &
kubectl -n monitoring port-forward deployment/alertmanager 9093:9093 &
kubectl -n monitoring port-forward statefulset/loki 3100:3100 &
kubectl -n monitoring port-forward statefulset/tempo 3200:3200 &
kubectl -n monitoring port-forward deployment/otel-collector 8889:8889 &

echo "Monitoring stack deployment complete!"
echo "Access the following UIs:"
echo "- Grafana: http://localhost:3000 (admin/aiops-admin-password)"
echo "  * Logs Overview Dashboard"
echo "  * Traces Overview Dashboard"
echo "  * ML Models Monitoring Dashboard"
echo "- Prometheus: http://localhost:9090"
echo "- AlertManager: http://localhost:9093"
echo "- Loki: http://localhost:3100"
echo "- Tempo: http://localhost:3200"
echo "- OpenTelemetry Metrics: http://localhost:8889/metrics"

# Print initial health check
echo -e "\nPerforming initial health check..."
for pod in $(kubectl -n monitoring get pods -o name); do
    echo "Status of $pod:"
    kubectl -n monitoring describe $pod | grep -A 5 "Conditions:"
done

# Verify ML metrics are being collected
echo -e "\nVerifying ML metrics collection..."
echo "Checking for ML metrics in Prometheus..."
kubectl -n monitoring exec -it deployment/prometheus -- wget -qO- http://localhost:9090/api/v1/query?query=model_accuracy:avg_5m

echo -e "\nChecking for ML alerts..."
kubectl -n monitoring exec -it deployment/alertmanager -- wget -qO- http://localhost:9093/api/v2/alerts

echo -e "\nSetup complete! Your AIOps monitoring stack is ready." 