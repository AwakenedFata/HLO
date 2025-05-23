// SSE client utility for admin panel
class AdminSSEClient {
  constructor() {
    this.eventSource = null
    this.eventListeners = {
      "pin-processed": [],
      "pins-batch-processed": [],
      "pin-updated": [],
      "pin-deleted": [],
      connected: [],
      disconnected: [],
      error: [],
      heartbeat: [],
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectTimer = null
    this.lastActivity = Date.now()
  }

  // Connect to SSE server
  async connect() {
  if (this.eventSource || this.isConnecting) {
    console.log("SSE: Already connected or connecting")
    return
  }

  this.isConnecting = true
  console.log("SSE: Attempting to connect...")

  try {
    this.eventSource = new EventSource("/api/sse", {
      withCredentials: true,
    })

    console.log("SSE: EventSource created")

    this.eventSource.onopen = (event) => {
      console.log("SSE: Connection opened", event)
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.lastActivity = Date.now()
      this._triggerEvent("connected", { message: "Connection established" })
    }

    this.eventSource.onerror = (event) => {
      console.error("SSE: Connection error", event)
      this.isConnecting = false

      // Attempt to detect unauthorized error from headers (Next.js won't expose it directly)
      const isFatalError = this.reconnectAttempts >= this.maxReconnectAttempts
      const isUnauthorized = event?.status === 401 || (event?.data && event.data.includes("Unauthorized"))

      this._triggerEvent("error", {
        message: isUnauthorized ? "Unauthorized - please login again." : "Connection error",
      })

      if (this.eventSource) {
        this.eventSource.close()
        this.eventSource = null
      }

      if (isFatalError || isUnauthorized) {
        console.warn("SSE: Stopping reconnect attempts (fatal or unauthorized error)")
        return
      }

      // Retry connection with exponential backoff
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
      console.log(`SSE: Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
      }

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, delay)
    }

    // Event handlers (same as existing logic)
    const safeJSON = (event) => {
      try {
        return JSON.parse(event.data)
      } catch {
        return {}
      }
    }

    const attachListener = (eventName) => {
      this.eventSource.addEventListener(eventName, (event) => {
        console.log(`SSE: Received ${eventName} event`, event)
        this.lastActivity = Date.now()
        const data = safeJSON(event)
        this._triggerEvent(eventName, data)
      })
    }

    ;[
      "connected",
      "heartbeat",
      "pin-processed",
      "pins-batch-processed",
      "pin-updated",
      "pin-deleted",
    ].forEach(attachListener)
  } catch (error) {
    console.error("SSE: Error initializing client", error)
    this.isConnecting = false
    this._triggerEvent("error", { message: error.message })

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("SSE: Max reconnection attempts reached. Stopping.")
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    console.log(`SSE: Retry in ${delay}ms (attempt ${this.reconnectAttempts})`)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}


  // Disconnect from SSE server
  disconnect() {
    console.log("SSE: Disconnecting...")

    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.isConnecting = false
    this._triggerEvent("disconnected", { message: "Disconnected from server" })
  }

  // Add event listener
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback)
    }
    return this
  }

  // Remove event listener
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter((cb) => cb !== callback)
    }
    return this
  }

  // Trigger event callbacks
  _triggerEvent(event, data) {
    console.log(`SSE: Triggering ${event} event`, data)
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`SSE: Error in ${event} event handler`, error)
        }
      })
    }

    // Also dispatch a DOM event
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(`sse-${event}`, { detail: data }))

        // For backward compatibility, also dispatch pin-data-updated event
        if (["pin-processed", "pins-batch-processed", "pin-updated", "pin-deleted"].includes(event)) {
          const updateEvent = new CustomEvent("pin-data-updated", {
            detail: { event, data },
          })
          window.dispatchEvent(updateEvent)
        }
      } catch (error) {
        console.error(`SSE: Error dispatching DOM event for ${event}`, error)
      }
    }
  }

  // Check if SSE is connected
  isConnected() {
    return this.eventSource && this.eventSource.readyState === EventSource.OPEN
  }

  // Get time since last activity
  getInactiveTime() {
    return Date.now() - this.lastActivity
  }
}

// Create singleton instance
let sseClientInstance = null

export function getAdminSSEClient() {
  if (!sseClientInstance && typeof window !== "undefined") {
    sseClientInstance = new AdminSSEClient()
  }
  return sseClientInstance
}

// Remove old initSSE and closeSSE functions as they're replaced by the class implementation
export default getAdminSSEClient