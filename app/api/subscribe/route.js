import { NextResponse } from "next/server"

export async function POST(req) {
  try {
    const { email } = await req.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 })
    }

    // Cek apakah email sudah ada di Brevo
    const checkResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
    })

    if (checkResponse.ok) {
      // Email sudah ada, update untuk memastikan ada di list
      const updateResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          listIds: [parseInt(process.env.BREVO_LIST_ID)],
          emailBlacklisted: false,
          smsBlacklisted: false,
          updateEnabled: true, // Penting untuk re-enable jika sebelumnya di-blacklist
        }),
      })

      if (!updateResponse.ok) {
        const updateData = await updateResponse.json()
        return NextResponse.json(
          { error: updateData?.message || "Email sudah terdaftar sebelumnya." },
          { status: updateResponse.status }
        )
      }

      return NextResponse.json({ message: "Email sudah terdaftar dan diperbarui!" }, { status: 200 })
    }

    // Email belum ada, buat contact baru
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        listIds: [parseInt(process.env.BREVO_LIST_ID)],
        updateEnabled: false, // Set false agar tidak update contact yang sudah ada
        emailBlacklisted: false,
        smsBlacklisted: false,
        attributes: {
          // Tambahkan attributes jika diperlukan untuk automation
          SUBSCRIBED_AT: new Date().toISOString(),
        },
      }),
    })

    const data = await response.json()

    // Handle duplicate contact error
    if (response.status === 400 && data?.code === "duplicate_parameter") {
      return NextResponse.json({ message: "Email sudah terdaftar sebelumnya!" }, { status: 200 })
    }

    if (!response.ok) {
      console.error("Brevo API Error:", data)
      return NextResponse.json(
        { error: data?.message || "Gagal subscribe, coba lagi." },
        { status: response.status }
      )
    }

    return NextResponse.json({ message: "Berhasil subscribe! Cek email untuk konfirmasi." }, { status: 201 })
  } catch (error) {
    console.error("Subscribe error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}