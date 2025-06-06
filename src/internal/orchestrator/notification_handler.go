package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

// NotificationType defines the type of notification
type NotificationType string

const (
	// NotificationSlack sends a notification to Slack
	NotificationSlack NotificationType = "slack"
	// NotificationEmail sends an email notification
	NotificationEmail NotificationType = "email"
	// NotificationWebhook sends a notification to a generic webhook
	NotificationWebhook NotificationType = "webhook"
)

// NotificationHandler handles the sending of notifications
type NotificationHandler struct {
	// Default configurations
	DefaultSlackWebhook string
	DefaultEmailConfig  EmailConfig
	DefaultWebhookURL   string

	// HTTP client for making webhook requests
	httpClient *http.Client
}

// EmailConfig contains email configuration
type EmailConfig struct {
	SMTPServer   string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	ToAddresses  []string
	CCAddresses  []string
	BCCAddresses []string
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SetDefaultSlackWebhook sets the default Slack webhook URL
func (h *NotificationHandler) SetDefaultSlackWebhook(webhookURL string) {
	h.DefaultSlackWebhook = webhookURL
}

// SetDefaultEmailConfig sets the default email configuration
func (h *NotificationHandler) SetDefaultEmailConfig(config EmailConfig) {
	h.DefaultEmailConfig = config
}

// SetDefaultWebhookURL sets the default webhook URL
func (h *NotificationHandler) SetDefaultWebhookURL(webhookURL string) {
	h.DefaultWebhookURL = webhookURL
}

// CanHandle returns true if this handler can handle the given action type
func (h *NotificationHandler) CanHandle(actionType ActionType) bool {
	return actionType == ActionNotify
}

// Execute performs the notification action
func (h *NotificationHandler) Execute(ctx context.Context, action Action) (*ActionResult, error) {
	// Get notification type
	notifTypeStr := action.Parameters["type"]
	if notifTypeStr == "" {
		notifTypeStr = "webhook" // Default to webhook
	}

	var notifType NotificationType
	switch strings.ToLower(notifTypeStr) {
	case "slack":
		notifType = NotificationSlack
	case "email":
		notifType = NotificationEmail
	case "webhook":
		notifType = NotificationWebhook
	default:
		return nil, fmt.Errorf("unsupported notification type: %s", notifTypeStr)
	}

	// Get notification content
	subject := action.Parameters["subject"]
	if subject == "" {
		subject = fmt.Sprintf("AIOps Notification for %s", action.Target)
	}

	message := action.Parameters["message"]
	if message == "" {
		message = fmt.Sprintf("Notification triggered for target: %s", action.Target)
	}

	var err error
	var details string

	// Send notification based on type
	switch notifType {
	case NotificationSlack:
		details, err = h.sendSlackNotification(ctx, action, subject, message)
	case NotificationEmail:
		details, err = h.sendEmailNotification(ctx, action, subject, message)
	case NotificationWebhook:
		details, err = h.sendWebhookNotification(ctx, action, subject, message)
	}

	if err != nil {
		return &ActionResult{
			Success:     false,
			Message:     fmt.Sprintf("Failed to send %s notification", notifType),
			Details:     err.Error(),
			CompletedAt: time.Now(),
		}, err
	}

	return &ActionResult{
		Success:     true,
		Message:     fmt.Sprintf("Successfully sent %s notification", notifType),
		Details:     details,
		CompletedAt: time.Now(),
	}, nil
}

// sendSlackNotification sends a notification to Slack
func (h *NotificationHandler) sendSlackNotification(ctx context.Context, action Action, subject, message string) (string, error) {
	webhookURL := action.Parameters["webhook_url"]
	if webhookURL == "" {
		webhookURL = h.DefaultSlackWebhook
	}

	if webhookURL == "" {
		return "", fmt.Errorf("slack webhook URL is required")
	}

	// Prepare the message payload
	payload := map[string]interface{}{
		"text": fmt.Sprintf("*%s*\n%s", subject, message),
		"attachments": []map[string]interface{}{
			{
				"color":      "#36a64f",
				"title":      "Target Information",
				"title_link": "",
				"fields": []map[string]interface{}{
					{
						"title": "Target",
						"value": action.Target,
						"short": true,
					},
					{
						"title": "Timestamp",
						"value": time.Now().Format(time.RFC3339),
						"short": true,
					},
				},
				"footer":      "AIOps Infrastructure",
				"footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
				"ts":          time.Now().Unix(),
			},
		},
	}

	// Convert payload to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal JSON payload: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send slack notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("received non-success status code: %d", resp.StatusCode)
	}

	return fmt.Sprintf("Slack notification sent to webhook (status code: %d)", resp.StatusCode), nil
}

// sendEmailNotification sends an email notification
func (h *NotificationHandler) sendEmailNotification(ctx context.Context, action Action, subject, message string) (string, error) {
	// Get email configuration
	smtpServer := action.Parameters["smtp_server"]
	smtpPortStr := action.Parameters["smtp_port"]
	username := action.Parameters["username"]
	password := action.Parameters["password"]
	fromAddress := action.Parameters["from_address"]
	toAddressesStr := action.Parameters["to_addresses"]

	// Use defaults if not specified
	if smtpServer == "" {
		smtpServer = h.DefaultEmailConfig.SMTPServer
	}

	if smtpPortStr == "" {
		smtpPortStr = fmt.Sprintf("%d", h.DefaultEmailConfig.SMTPPort)
	}

	if username == "" {
		username = h.DefaultEmailConfig.Username
	}

	if password == "" {
		password = h.DefaultEmailConfig.Password
	}

	if fromAddress == "" {
		fromAddress = h.DefaultEmailConfig.FromAddress
	}

	var toAddresses []string
	if toAddressesStr != "" {
		toAddresses = strings.Split(toAddressesStr, ",")
	} else if len(h.DefaultEmailConfig.ToAddresses) > 0 {
		toAddresses = h.DefaultEmailConfig.ToAddresses
	}

	// Validate configuration
	if smtpServer == "" || smtpPortStr == "" || fromAddress == "" || len(toAddresses) == 0 {
		return "", fmt.Errorf("incomplete email configuration")
	}

	// Compose email
	headers := map[string]string{
		"From":    fromAddress,
		"To":      strings.Join(toAddresses, ", "),
		"Subject": subject,
	}

	body := fmt.Sprintf("Target: %s\nTimestamp: %s\n\n%s",
		action.Target,
		time.Now().Format(time.RFC3339),
		message)

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	// Send email
	addr := fmt.Sprintf("%s:%s", smtpServer, smtpPortStr)

	var auth smtp.Auth
	if username != "" && password != "" {
		auth = smtp.PlainAuth("", username, password, smtpServer)
	}

	err := smtp.SendMail(addr, auth, fromAddress, toAddresses, []byte(msg.String()))
	if err != nil {
		return "", fmt.Errorf("failed to send email: %w", err)
	}

	return fmt.Sprintf("Email notification sent to %s", strings.Join(toAddresses, ", ")), nil
}

// sendWebhookNotification sends a notification to a webhook
func (h *NotificationHandler) sendWebhookNotification(ctx context.Context, action Action, subject, message string) (string, error) {
	webhookURL := action.Parameters["webhook_url"]
	if webhookURL == "" {
		webhookURL = h.DefaultWebhookURL
	}

	if webhookURL == "" {
		return "", fmt.Errorf("webhook URL is required")
	}

	// Prepare payload
	payload := map[string]interface{}{
		"subject":   subject,
		"message":   message,
		"target":    action.Target,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// Add custom fields if any
	customFields := make(map[string]string)
	for k, v := range action.Parameters {
		if strings.HasPrefix(k, "field_") {
			fieldName := strings.TrimPrefix(k, "field_")
			customFields[fieldName] = v
		}
	}

	if len(customFields) > 0 {
		payload["fields"] = customFields
	}

	// Convert payload to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal JSON payload: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send webhook notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("received non-success status code: %d", resp.StatusCode)
	}

	return fmt.Sprintf("Webhook notification sent to %s (status code: %d)", webhookURL, resp.StatusCode), nil
}
