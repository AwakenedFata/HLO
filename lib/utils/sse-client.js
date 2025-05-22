// SSE client utility for admin panel
let eventSource = null
let reconnectAttempt = 0
const MAX_RECONNECT_ATTEMPTS = 5

export function initSSE() {
  if (eventSource) {
    return eventSource
  }

  try {
    eventSource = new EventSource("/api/sse", {
      withCredentials: true,
    })

    eventSource.onopen = () => {
      console.log("SSE connection established")
      reconnectAttempt = 0 // Reset reconnect attempts on successful connection
    }

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error)
      eventSource.close()
      eventSource = null

      // Add a reconnection strategy with exponential backoff
      if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000)
        console.log(`Attempting to reconnect SSE in ${delay}ms (attempt ${reconnectAttempt})`)
        setTimeout(() => initSSE(), delay)
      } else {
        console.error("Max SSE reconnection attempts reached")
      }
    }

    // Add event listeners for your specific events
    eventSource.addEventListener("pin-update", (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log("Pin update received:", data)

        // Trigger a re-fetch or state update
        window.dispatchEvent(new CustomEvent("pin-data-updated", { detail: data }))
      } catch (error) {
        console.error("Error processing SSE event:", error)
      }
    })

    return eventSource
  } catch (error) {
    console.error("Failed to initialize SSE:", error)
    return null
  }
}

export function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

// Update the connect method to handle connection issues better
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
    }
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.isConnecting = false
    this.clientId = null
    this.lastEventTime = 0
    this.connectionTimeout = null
    this.heartbeatInterval = null
  }

  // Connect to SSE server
  async connect() {
    // Jika sudah terhubung atau sedang mencoba terhubung, jangan lakukan apa-apa
    if (this.eventSource || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      // Get auth token from sessionStorage
      const token = sessionStorage.getItem("adminToken")

      if (!token) {
        console.error("No authentication token found")
        this._triggerEvent("error", { message: "No authentication token found" })
        this.isConnecting = false

        // Even without a token, trigger a data refresh
        this._triggerEvent("connected", { fallback: true, message: "No token, using fallback mode" })
        return
      }

      // Create EventSource with auth token
      this.eventSource = new EventSource(`/api/sse`, {
        withCredentials: true,
      })

      // Set up connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.eventSource && this.eventSource.readyState !== EventSource.OPEN) {
          console.error("SSE connection timeout")
          this._triggerEvent("error", { message: "Connection timeout" })
          this.disconnect()

          // Even on timeout, trigger a data refresh
          this._triggerEvent("connected", { fallback: true, message: "Connection timeout, using fallback mode" })

          // Try to reconnect after timeout
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            setTimeout(() => this.connect(), 2000 * this.reconnectAttempts)
          }
        }
      }, 10000)

      // Handle SSE events
      this.eventSource.onopen = () => {
        console.log("SSE connection opened")
        clearTimeout(this.connectionTimeout)
        this.reconnectAttempts = 0
        this.lastEventTime = Date.now()
        this.isConnecting = false
      }

      this.eventSource.onerror = (error) => {
        console.error("SSE connection error:", error)
        clearTimeout(this.connectionTimeout)
        this.isConnecting = false

        if (this.eventSource) {
          this.eventSource.close()
          this.eventSource = null
        }

        this._triggerEvent("error", { message: "Connection error" })
        this._triggerEvent("disconnected", { message: "Disconnected from server" })

        // Even on error, trigger a data refresh
        this._triggerEvent("connected", { fallback: true, message: "Connection error, using fallback mode" })

        // Try to reconnect after error
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => this.connect(), 2000 * this.reconnectAttempts)
        }
      }

      // Handle custom events
      this.eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data)
        console.log("SSE connected:", data)
        this.clientId = data.clientId
        this._triggerEvent("connected", data)
      })

      this.eventSource.addEventListener("heartbeat", (event) => {
        this.lastEventTime = Date.now()
      })

      this.eventSource.addEventListener("pin-processed", (event) => {
        const data = JSON.parse(event.data)
        this._triggerEvent("pin-processed", data)
      })

      this.eventSource.addEventListener("pins-batch-processed", (event) => {
        const data = JSON.parse(event.data)
        this._triggerEvent("pins-batch-processed", data)
      })

      this.eventSource.addEventListener("pin-updated", (event) => {
        const data = JSON.parse(event.data)
        this._triggerEvent("pin-updated", data)
      })

      this.eventSource.addEventListener("pin-deleted", (event) => {
        const data = JSON.parse(event.data)
        this._triggerEvent("pin-deleted", data)
      })

      // Start heartbeat check
      this._startHeartbeatCheck()
    } catch (error) {
      console.error("Error initializing SSE client:", error)
      this._triggerEvent("error", { message: error.message })
      this.isConnecting = false

      // Even on error, trigger a data refresh
      this._triggerEvent("connected", { fallback: true, message: "Initialization error, using fallback mode" })
    }
  }

  // Start heartbeat check to detect stale connections
  _startHeartbeatCheck() {
    // Check every minute if we've received a heartbeat
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      // If no heartbeat for 2 minutes, reconnect
      if (now - this.lastEventTime > 120000) {
        console.warn("No heartbeat received for 2 minutes, reconnecting...")
        this.reconnect()
      }
    }, 60000)
  }

  // Disconnect from SSE server
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    this.isConnecting = false
    this.clientId = null
  }

  // Reconnect to SSE server
  reconnect() {
    this.disconnect()
    this.connect()
  }

  // Add event listener
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback)
    }
    return this // Allow chaining
  }

  // Remove event listener
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter((cb) => cb !== callback)
    }
    return this // Allow chaining
  }

  // Trigger event callbacks
  _triggerEvent(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error)
        }
      })
    }

    // Also dispatch a DOM event for components that listen via addEventListener
    if (typeof window !== "undefined") {
      try {
        // Dispatch specific event
        const customEvent = new CustomEvent(`sse-${event}`, { detail: data })
        window.dispatchEvent(customEvent)

        // For backward compatibility, also dispatch pin-data-updated event
        if (["pin-processed", "pins-batch-processed", "pin-updated", "pin-deleted"].includes(event)) {
          const updateEvent = new CustomEvent("pin-data-updated", {
            detail: { event, data },
          })
          window.dispatchEvent(updateEvent)
        }
      } catch (error) {
        console.error(`Error dispatching DOM event for ${event}:`, error)
      }
    }
  }

  // Check if SSE is connected
  isConnected() {
    return this.eventSource && this.eventSource.readyState === EventSource.OPEN
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

export default getAdminSSEClient
