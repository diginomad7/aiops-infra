package orchestrator

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// KubernetesHandler handles Kubernetes-based remediation actions
type KubernetesHandler struct {
	clientset *kubernetes.Clientset
}

// NewKubernetesHandlerInCluster creates a new Kubernetes handler using in-cluster config
func NewKubernetesHandlerInCluster() (*KubernetesHandler, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	return &KubernetesHandler{
		clientset: clientset,
	}, nil
}

// NewKubernetesHandlerWithKubeconfig creates a new Kubernetes handler using kubeconfig
func NewKubernetesHandlerWithKubeconfig(kubeconfigPath string) (*KubernetesHandler, error) {
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create config from kubeconfig: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	return &KubernetesHandler{
		clientset: clientset,
	}, nil
}

// CanHandle returns true if this handler can handle the given action type
func (h *KubernetesHandler) CanHandle(actionType ActionType) bool {
	return actionType == ActionRestart || actionType == ActionScale
}

// Execute performs the remediation action
func (h *KubernetesHandler) Execute(ctx context.Context, action Action) (*ActionResult, error) {
	// Extract common parameters
	namespace := action.Parameters["namespace"]
	if namespace == "" {
		namespace = "default"
	}

	resourceType := action.Parameters["resource_type"]
	resourceName := action.Parameters["resource_name"]

	if resourceType == "" || resourceName == "" {
		return nil, fmt.Errorf("resource_type and resource_name are required parameters")
	}

	var err error
	details := ""

	switch action.Type {
	case ActionRestart:
		details, err = h.restartResource(ctx, namespace, resourceType, resourceName)
	case ActionScale:
		replicas := action.Parameters["replicas"]
		if replicas == "" {
			return nil, fmt.Errorf("replicas parameter is required for scale action")
		}
		details, err = h.scaleResource(ctx, namespace, resourceType, resourceName, replicas)
	default:
		return nil, fmt.Errorf("unsupported action type: %s", action.Type)
	}

	if err != nil {
		return &ActionResult{
			Success:     false,
			Message:     fmt.Sprintf("Failed to execute %s action", action.Type),
			Details:     err.Error(),
			CompletedAt: time.Now(),
		}, err
	}

	return &ActionResult{
		Success:     true,
		Message:     fmt.Sprintf("Successfully executed %s action", action.Type),
		Details:     details,
		CompletedAt: time.Now(),
	}, nil
}

// restartResource restarts a Kubernetes resource by type
func (h *KubernetesHandler) restartResource(ctx context.Context, namespace, resourceType, resourceName string) (string, error) {
	switch resourceType {
	case "deployment":
		// For deployments, we patch the pod template with a restart annotation
		patch := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339))
		_, err := h.clientset.AppsV1().Deployments(namespace).Patch(ctx, resourceName, "application/strategic-merge-patch+json", []byte(patch), metav1.PatchOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to patch deployment: %w", err)
		}
		return fmt.Sprintf("Restarted deployment %s in namespace %s", resourceName, namespace), nil

	case "statefulset":
		// For statefulsets, we patch the pod template with a restart annotation
		patch := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339))
		_, err := h.clientset.AppsV1().StatefulSets(namespace).Patch(ctx, resourceName, "application/strategic-merge-patch+json", []byte(patch), metav1.PatchOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to patch statefulset: %w", err)
		}
		return fmt.Sprintf("Restarted statefulset %s in namespace %s", resourceName, namespace), nil

	case "pod":
		// For pods, we delete them and let the controller recreate them
		err := h.clientset.CoreV1().Pods(namespace).Delete(ctx, resourceName, metav1.DeleteOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to delete pod: %w", err)
		}
		return fmt.Sprintf("Deleted pod %s in namespace %s", resourceName, namespace), nil

	default:
		return "", fmt.Errorf("unsupported resource type: %s", resourceType)
	}
}

// scaleResource scales a Kubernetes resource
func (h *KubernetesHandler) scaleResource(ctx context.Context, namespace, resourceType, resourceName, replicas string) (string, error) {
	// Parse replicas
	var scale int32
	if _, err := fmt.Sscanf(replicas, "%d", &scale); err != nil {
		return "", fmt.Errorf("invalid replicas value: %s", replicas)
	}

	switch resourceType {
	case "deployment":
		// Get the deployment
		deployment, err := h.clientset.AppsV1().Deployments(namespace).Get(ctx, resourceName, metav1.GetOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to get deployment: %w", err)
		}

		// Update replicas
		deployment.Spec.Replicas = &scale
		_, err = h.clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to update deployment: %w", err)
		}

		return fmt.Sprintf("Scaled deployment %s in namespace %s to %d replicas", resourceName, namespace, scale), nil

	case "statefulset":
		// Get the statefulset
		statefulset, err := h.clientset.AppsV1().StatefulSets(namespace).Get(ctx, resourceName, metav1.GetOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to get statefulset: %w", err)
		}

		// Update replicas
		statefulset.Spec.Replicas = &scale
		_, err = h.clientset.AppsV1().StatefulSets(namespace).Update(ctx, statefulset, metav1.UpdateOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to update statefulset: %w", err)
		}

		return fmt.Sprintf("Scaled statefulset %s in namespace %s to %d replicas", resourceName, namespace, scale), nil

	default:
		return "", fmt.Errorf("unsupported resource type for scaling: %s", resourceType)
	}
}
