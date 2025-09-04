package api

import (
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

// EventsHandler handles GET /v1/events (WebSocket) - streams all service state changes
func (h *Handlers) EventsHandler(c *gin.Context, eventCache *events.EventCache) {
	// Upgrade to WebSocket
	conn, err := WebSocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Error().Err(err).Msg("failed to upgrade to websocket for events")
		return
	}
	defer conn.Close()

	// Add client to event cache for broadcasts
	eventCache.AddWebSocketClient(conn)
	defer eventCache.RemoveWebSocketClient(conn)

	// Send current service states immediately
	states := eventCache.GetAllServiceStates()
	for _, state := range states {
		if err := conn.WriteJSON(state); err != nil {
			log.Error().Err(err).Msg("error writing initial state to websocket")
			return
		}
	}

	// Keep connection alive and handle client messages
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Debug().Err(err).Msg("websocket ping failed")
				return
			}
		default:
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Error().Err(err).Msg("websocket error")
				}
				return
			}
		}
	}
}

// ServiceStateHandler handles GET /v1/services/:id/state - gets current service state
func (h *Handlers) ServiceStateHandler(c *gin.Context, eventCache *events.EventCache) {
	// This would be a regular HTTP endpoint to get current service state
	// Implementation details depend on how you want to integrate service ID lookup
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented yet"})
}