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
    }
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.isConnecting = false
    this.clientId = null
    this.lastEventTime = 0
    this.connectionTimeout = null
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
