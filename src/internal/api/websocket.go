package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// WebSocketGateway manages WebSocket connections for real-time updates
type WebSocketGateway struct {
	connections map[string]*ConnectionWrapper
	mutex       sync.RWMutex
	upgrader    websocket.Upgrader
	eventChan   chan Event
}

// ConnectionWrapper wraps a WebSocket connection with metadata
type ConnectionWrapper struct {
	conn          *websocket.Conn
	clientID      string
	subscriptions map[string]bool // topic -> subscribed
	lastPing      time.Time
	writeMutex    sync.Mutex
}

// Event represents a real-time event to be sent to clients
type Event struct {
	Type      string      `json:"type"`
	Topic     string      `json:"topic"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	ClientID  string      `json:"client_id,omitempty"` // Empty means broadcast
}

// EventType constants
const (
	EventDetectorCreated = "detector_created"
	EventDetectorUpdated = "detector_updated"
	EventDetectorDeleted = "detector_deleted"
	EventDetectorStarted = "detector_started"
	EventDetectorStopped = "detector_stopped"
	EventAnomalyDetected = "anomaly_detected"
	EventDetectorHealth  = "detector_health"
	EventDetectorStatus  = "detector_status"
	EventHeartbeat       = "heartbeat"
)

// Topic constants
const (
	TopicDetectors = "detectors"
	TopicAnomalies = "anomalies"
	TopicSystem    = "system"
)

// NewWebSocketGateway creates a new WebSocket gateway
func NewWebSocketGateway() *WebSocketGateway {
	return &WebSocketGateway{
		connections: make(map[string]*ConnectionWrapper),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		eventChan: make(chan Event, 100),
	}
}

// Start starts the WebSocket gateway event processing
func (gw *WebSocketGateway) Start(ctx context.Context) {
	// Start event processing goroutine
	go gw.processEvents(ctx)

	// Start connection cleanup goroutine
	go gw.cleanupConnections(ctx)

	// Start heartbeat goroutine
	go gw.sendHeartbeats(ctx)
}

// HandleWebSocket handles WebSocket connection upgrade and management
func (gw *WebSocketGateway) HandleWebSocket(c *gin.Context) {
	// Upgrade HTTP connection to WebSocket
	conn, err := gw.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Generate client ID
	clientID := fmt.Sprintf("client_%d", time.Now().UnixNano())

	// Create connection wrapper
	wrapper := &ConnectionWrapper{
		conn:          conn,
		clientID:      clientID,
		subscriptions: make(map[string]bool),
		lastPing:      time.Now(),
	}

	// Register connection
	gw.mutex.Lock()
	gw.connections[clientID] = wrapper
	gw.mutex.Unlock()

	log.Printf("WebSocket client connected: %s", clientID)

	// Send welcome message
	gw.sendToClient(clientID, Event{
		Type:      "connected",
		Topic:     TopicSystem,
		Data:      map[string]string{"client_id": clientID},
		Timestamp: time.Now(),
	})

	// Handle client messages
	go gw.handleClientMessages(wrapper)

	// Wait for connection to close
	gw.waitForClose(wrapper)

	// Cleanup connection
	gw.mutex.Lock()
	delete(gw.connections, clientID)
	gw.mutex.Unlock()

	log.Printf("WebSocket client disconnected: %s", clientID)
}

// handleClientMessages handles incoming messages from WebSocket clients
func (gw *WebSocketGateway) handleClientMessages(wrapper *ConnectionWrapper) {
	defer wrapper.conn.Close()

	for {
		_, message, err := wrapper.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// Update last ping time
		wrapper.lastPing = time.Now()

		// Parse message
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Invalid WebSocket message from %s: %v", wrapper.clientID, err)
			continue
		}

		// Handle different message types
		gw.handleClientMessage(wrapper, msg)
	}
}

// handleClientMessage processes a single client message
func (gw *WebSocketGateway) handleClientMessage(wrapper *ConnectionWrapper, msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "subscribe":
		if topic, ok := msg["topic"].(string); ok {
			wrapper.subscriptions[topic] = true
			log.Printf("Client %s subscribed to topic: %s", wrapper.clientID, topic)
		}

	case "unsubscribe":
		if topic, ok := msg["topic"].(string); ok {
			delete(wrapper.subscriptions, topic)
			log.Printf("Client %s unsubscribed from topic: %s", wrapper.clientID, topic)
		}

	case "ping":
		// Respond with pong
		gw.sendToClient(wrapper.clientID, Event{
			Type:      "pong",
			Topic:     TopicSystem,
			Data:      map[string]interface{}{"timestamp": time.Now()},
			Timestamp: time.Now(),
		})
	}
}

// waitForClose waits for the WebSocket connection to close
func (gw *WebSocketGateway) waitForClose(wrapper *ConnectionWrapper) {
	// This will block until the connection is closed
	for {
		_, _, err := wrapper.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// processEvents processes events from the event channel
func (gw *WebSocketGateway) processEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-gw.eventChan:
			gw.broadcastEvent(event)
		}
	}
}

// broadcastEvent sends an event to all subscribed clients
func (gw *WebSocketGateway) broadcastEvent(event Event) {
	gw.mutex.RLock()
	defer gw.mutex.RUnlock()

	for clientID, wrapper := range gw.connections {
		// Check if client wants this event
		if event.ClientID != "" && event.ClientID != clientID {
			continue // Targeted message for different client
		}

		// Check subscription
		if !wrapper.subscriptions[event.Topic] && event.Topic != TopicSystem {
			continue // Client not subscribed to this topic
		}

		// Send event to client
		go gw.sendToClient(clientID, event)
	}
}

// sendToClient sends an event to a specific client
func (gw *WebSocketGateway) sendToClient(clientID string, event Event) {
	gw.mutex.RLock()
	wrapper, exists := gw.connections[clientID]
	gw.mutex.RUnlock()

	if !exists {
		return
	}

	wrapper.writeMutex.Lock()
	defer wrapper.writeMutex.Unlock()

	// Set write deadline
	wrapper.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	// Send event
	if err := wrapper.conn.WriteJSON(event); err != nil {
		log.Printf("Failed to send event to client %s: %v", clientID, err)

		// Close connection on write error
		wrapper.conn.Close()
	}
}

// cleanupConnections removes stale connections
func (gw *WebSocketGateway) cleanupConnections(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			gw.cleanupStaleConnections()
		}
	}
}

// cleanupStaleConnections removes connections that haven't pinged recently
func (gw *WebSocketGateway) cleanupStaleConnections() {
	gw.mutex.Lock()
	defer gw.mutex.Unlock()

	cutoff := time.Now().Add(-2 * time.Minute)

	for clientID, wrapper := range gw.connections {
		if wrapper.lastPing.Before(cutoff) {
			log.Printf("Cleaning up stale connection: %s", clientID)
			wrapper.conn.Close()
			delete(gw.connections, clientID)
		}
	}
}

// sendHeartbeats sends periodic heartbeat messages
func (gw *WebSocketGateway) sendHeartbeats(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			gw.SendEvent(Event{
				Type:      EventHeartbeat,
				Topic:     TopicSystem,
				Data:      map[string]interface{}{"timestamp": time.Now()},
				Timestamp: time.Now(),
			})
		}
	}
}

// SendEvent queues an event to be sent to clients
func (gw *WebSocketGateway) SendEvent(event Event) {
	select {
	case gw.eventChan <- event:
		// Event queued successfully
	default:
		log.Printf("Event channel full, dropping event: %+v", event)
	}
}

// GetConnectedClients returns the number of connected clients
func (gw *WebSocketGateway) GetConnectedClients() int {
	gw.mutex.RLock()
	defer gw.mutex.RUnlock()
	return len(gw.connections)
}

// GetClientInfo returns information about connected clients
func (gw *WebSocketGateway) GetClientInfo() map[string]interface{} {
	gw.mutex.RLock()
	defer gw.mutex.RUnlock()

	clients := make([]map[string]interface{}, 0, len(gw.connections))
	for clientID, wrapper := range gw.connections {
		subscriptions := make([]string, 0, len(wrapper.subscriptions))
		for topic := range wrapper.subscriptions {
			subscriptions = append(subscriptions, topic)
		}

		clients = append(clients, map[string]interface{}{
			"client_id":     clientID,
			"connected_at":  wrapper.lastPing,
			"subscriptions": subscriptions,
		})
	}

	return map[string]interface{}{
		"total_clients": len(gw.connections),
		"clients":       clients,
	}
}
