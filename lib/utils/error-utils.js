/**
 * Utility functions for error handling
 */

/**
 * Sets an error message in the component state
 * This is a simple utility function to standardize error handling
 *
 * @param {string} message - The error message to set
 * @param {Function} setErrorState - The state setter function for errors
 * @param {number} [timeout=0] - Optional timeout to clear the error after (in ms)
 */
export function setError(message, setErrorState, timeout = 0) {
  setErrorState(message)

  // If timeout is provided, clear the error after the specified time
  if (timeout > 0) {
    setTimeout(() => {
      setErrorState("")
    }, timeout)
  }
}

/**
 * Formats API error messages for consistent display
 *
 * @param {Error} error - The error object from an API call
 * @returns {string} - Formatted error message
 */
export function formatApiError(error) {
  if (error.response?.status === 429) {
    return "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
  }

  if (error.response?.status === 401) {
    return "Sesi Anda telah berakhir. Silakan login kembali."
  }

  if (error.response?.status === 404) {
    return "Data tidak ditemukan."
  }

  return error.response?.data?.error || error.message || "Terjadi kesalahan pada server."
}

/**
 * Handles common API errors with appropriate actions
 *
 * @param {Error} error - The error object from an API call
 * @param {Function} setErrorState - The state setter function for errors
 * @param {Object} options - Additional options
 * @returns {boolean} - True if the error was handled, false otherwise
 */
export function handleApiError(error, setErrorState, options = {}) {
  const { router, redirectOnAuth = true } = options

  if (error.response?.status === 401 && redirectOnAuth && router) {
    // Clear auth tokens
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("adminToken")
      sessionStorage.removeItem("refreshToken")
    }

    // Redirect to login
    router.push("/admin/login")
    return true
  }

  // Set the error message
  setError(formatApiError(error), setErrorState)
  return false
}
