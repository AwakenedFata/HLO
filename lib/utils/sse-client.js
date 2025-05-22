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

// Implementasi SSE client yang sangat minimal
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
  }

  // Connect to SSE server
  async connect() {
    // Jika sudah terhubung atau sedang mencoba terhubung, jangan lakukan apa-apa
    if (this.eventSource || this.isConnecting) {
      console.log("SSE: Already connected or connecting")
      return
    }

    this.isConnecting = true
    console.log("SSE: Attempting to connect...")

    try {
      // Create EventSource
      this.eventSource = new EventSource("/api/sse", {
        withCredentials: true,
      })

      console.log("SSE: EventSource created")

      // Handle SSE events
      this.eventSource.onopen = (event) => {
        console.log("SSE: Connection opened", event)
        this.isConnecting = false
        this.reconnectAttempts = 0
        this._triggerEvent("connected", { message: "Connection established" })
      }

      this.eventSource.onerror = (event) => {
        console.error("SSE: Connection error", event)
        this.isConnecting = false
        this._triggerEvent("error", { message: "Connection error" })

        // Close the connection on error
        if (this.eventSource) {
          this.eventSource.close()
          this.eventSource = null
        }

        // Try to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
          console.log(`SSE: Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

          // Clear any existing reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
          }

          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
          }, delay)
        } else {
          console.error("SSE: Max reconnection attempts reached")
        }
      }

      // Handle custom events
      this.eventSource.addEventListener("connected", (event) => {
        console.log("SSE: Received connected event", event)
        try {
          const data = JSON.parse(event.data)
          this._triggerEvent("connected", data)
        } catch (error) {
          console.error("SSE: Error parsing connected event data", error)
        }
      })

      this.eventSource.addEventListener("heartbeat", (event) => {
        console.log("SSE: Received heartbeat")
        try {
          const timestamp = JSON.parse(event.data)
          this._triggerEvent("heartbeat", { timestamp })
        } catch (error) {
          // Heartbeat might just be a timestamp, not JSON
          this._triggerEvent("heartbeat", { timestamp: Date.now() })
        }
      })

      this.eventSource.addEventListener("pin-processed", (event) => {
        console.log("SSE: Received pin-processed event", event)
        try {
          const data = JSON.parse(event.data)
          this._triggerEvent("pin-processed", data)
        } catch (error) {
          console.error("SSE: Error parsing pin-processed event data", error)
        }
      })

      this.eventSource.addEventListener("pins-batch-processed", (event) => {
        console.log("SSE: Received pins-batch-processed event", event)
        try {
          const data = JSON.parse(event.data)
          this._triggerEvent("pins-batch-processed", data)
        } catch (error) {
          console.error("SSE: Error parsing pins-batch-processed event data", error)
        }
      })

      this.eventSource.addEventListener("pin-updated", (event) => {
        console.log("SSE: Received pin-updated event", event)
        try {
          const data = JSON.parse(event.data)
          this._triggerEvent("pin-updated", data)
        } catch (error) {
          console.error("SSE: Error parsing pin-updated event data", error)
        }
      })

      this.eventSource.addEventListener("pin-deleted", (event) => {
        console.log("SSE: Received pin-deleted event", event)
        try {
          const data = JSON.parse(event.data)
          this._triggerEvent("pin-deleted", data)
        } catch (error) {
          console.error("SSE: Error parsing pin-deleted event data", error)
        }
      })
    } catch (error) {
      console.error("SSE: Error initializing client", error)
      this.isConnecting = false
      this._triggerEvent("error", { message: error.message })

      // Try to reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
        console.log(`SSE: Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
        }

        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null
          this.connect()
        }, delay)
      }
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
