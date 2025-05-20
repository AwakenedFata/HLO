// Fungsi untuk memeriksa apakah token masih valid
export const isTokenValid = () => {
  const token = sessionStorage.getItem("adminToken")
  if (!token) return false

  try {
    // Decode token (tanpa verifikasi signature)
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(window.atob(base64))

    // Cek apakah token sudah expired
    const currentTime = Date.now() / 1000
    return payload.exp > currentTime
  } catch (error) {
    console.error("Error checking token validity:", error)
    return false
  }
}

// Fungsi untuk logout
export const logout = (navigate) => {
  sessionStorage.removeItem("adminToken")
  sessionStorage.removeItem("adminUsername")
  if (navigate) {
    navigate("/admin/login")
  }
}

// Fungsi untuk setup auto-logout setelah periode tidak aktif
export const setupInactivityTimer = (logoutCallback, timeoutMinutes = 15) => {
  let inactivityTimer

  const resetTimer = () => {
    clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(
      () => {
        // Auto logout setelah periode tidak aktif
        if (sessionStorage.getItem("adminToken")) {
          console.log("Auto logout karena tidak aktif")
          logoutCallback()
        }
      },
      timeoutMinutes * 60 * 1000,
    ) // Konversi menit ke milidetik
  }

  // Reset timer saat ada aktivitas
  const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"]
  events.forEach((event) => {
    document.addEventListener(event, resetTimer)
  })

  // Setup timer awal
  resetTimer()

  // Fungsi untuk cleanup
  return () => {
    clearTimeout(inactivityTimer)
    events.forEach((event) => {
      document.removeEventListener(event, resetTimer)
    })
  }
}
