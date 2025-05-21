import { io } from "socket.io-client"

// Socket.io client utility for admin panel
class AdminSocketClient {
  constructor() {
    this.socket = null
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
    this.isInitializing = false
  }

  // Connect to Socket.io server
  async connect() {
    // Jika socket sudah ada atau sedang dalam proses inisialisasi, jangan lakukan apa-apa
    if (this.socket || this.isInitializing) {
      return
    }

    this.isInitializing = true

    try {
      // Ping API route terlebih dahulu untuk memastikan server siap
      const response = await fetch("/api/socket")
      if (!response.ok) {
        throw new Error(`Failed to initialize Socket.io: ${response.status}`)
      }

      // Get auth token from sessionStorage
      const token = sessionStorage.getItem("adminToken")

      if (!token) {
        console.error("No authentication token found")
        this._triggerEvent("error", { message: "No authentication token found" })
        this.isInitializing = false
        return
      }

      // Create Socket.io connection with improved configuration
      this.socket = io("/admin", {
        path: "/api/socket",
        auth: { token },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ["websocket", "polling"], // Try WebSocket first, then polling
        forceNew: true, // Force a new connection
        autoConnect: true, // Connect automatically
      })

      // Handle Socket.io events
      this.socket.on("connect", () => {
        console.log("Admin Socket.io connected")
        this.reconnectAttempts = 0
        this._triggerEvent("connected", { message: "Connected to server" })
      })

      this.socket.on("disconnect", (reason) => {
        console.log(`Admin Socket.io disconnected: ${reason}`)
        this._triggerEvent("disconnected", { message: "Disconnected from server", reason })
      })

      this.socket.on("connect_error", (error) => {
        console.error("Admin Socket.io connection error:", error.message)
        this._triggerEvent("error", { message: `Connection error: ${error.message}` })

        // Implement custom reconnection logic
        this.reconnectAttempts++
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error("Max reconnection attempts reached, giving up")
          this.disconnect()
        }
      })

      // Handle custom events
      this.socket.on("pin-processed", (data) => {
        this._triggerEvent("pin-processed", data)
      })

      this.socket.on("pins-batch-processed", (data) => {
        this._triggerEvent("pins-batch-processed", data)
      })

      this.socket.on("pin-updated", (data) => {
        this._triggerEvent("pin-updated", data)
      })

      this.socket.on("pin-deleted", (data) => {
        this._triggerEvent("pin-deleted", data)
      })
    } catch (error) {
      console.error("Error initializing Socket.io client:", error)
      this._triggerEvent("error", { message: error.message })
    } finally {
      this.isInitializing = false
    }
  }

  // Disconnect from Socket.io server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
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

  // Check if Socket.io is connected
  isConnected() {
    return this.socket && this.socket.connected
  }

  // Manual reconnect method
  reconnect() {
    this.disconnect()
    this.connect()
  }
}

// Create singleton instance
let socketClientInstance = null

export function getAdminSocketClient() {
  if (!socketClientInstance && typeof window !== "undefined") {
    socketClientInstance = new AdminSocketClient()
  }
  return socketClientInstance
}

export default getAdminSocketClient
