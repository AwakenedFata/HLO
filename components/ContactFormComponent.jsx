"use client"

import { useState } from "react"
import { Container, Row, Col, Form, Spinner } from "react-bootstrap"
import { FaWhatsapp, FaInstagram } from "react-icons/fa"
import { IoIosMail } from "react-icons/io"
import styled from "styled-components"
import axios from "axios"

const FormContainer = styled.div`
  width: 270px;
`

function ContactFormComponent() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const [loading, setLoading] = useState(false)
  const [buttonStatus, setButtonStatus] = useState("idle") 
  // idle | success | error

  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
    setFieldErrors({
      ...fieldErrors,
      [name]: "",
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setButtonStatus("idle")
    setFieldErrors({})

    try {
      const response = await axios.post("/api/contact-public", formData)

      if (response.status === 201) {
        setButtonStatus("success")

        // Reset form
        setFormData({
          name: "",
          email: "",
          subject: "",
          message: "",
        })

        // Reset button text
        setTimeout(() => {
          setButtonStatus("idle")
        }, 3000)
      }
    } catch (err) {
      const zodErrors = err.response?.data?.errors

      if (zodErrors && Array.isArray(zodErrors)) {
        const formattedErrors = {}
        zodErrors.forEach((err) => {
          if (err.path?.length > 0) {
            formattedErrors[err.path[0]] = err.message
          }
        })
        setFieldErrors(formattedErrors)
      }

      setButtonStatus("error")

      // kembalikan tombol normal
      setTimeout(() => {
        setButtonStatus("idle")
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  const renderButtonText = () => {
    if (loading)
      return (
        <>
          <Spinner animation="border" size="sm" className="me-2" role="status" />
          Mengirim...
        </>
      )
    if (buttonStatus === "success") return "Berhasil"
    if (buttonStatus === "error") return "Gagal"
    return "Kirim Pesan"
  }

  return (
    <div id="contact-us" className="contact-us-section">
      <Container>
        <Row className="justify-content-center text-center mb-4">
          <Col md={10} lg={8}>
            <h5 className="contact-heading">CONTACT US</h5>
            <h1 className="contact-title">
              Hubungi Kami untuk <br /> Informasi Lebih Lanjut
            </h1>
          </Col>
        </Row>

        <Row className="justify-content-center">
          <Col md={10} lg={8}>
            <Row>
              {/* Left Column - Form */}
              <Col lg={6}>
                <h3 className="contact-subtitle mb-4">Tulis pesan kepada kami</h3>
                <Form onSubmit={handleSubmit}>
                  <FormContainer>

                    {/* Nama */}
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        placeholder="Nama"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={loading}
                        className={`contact-input ${fieldErrors.name ? "is-invalid" : ""}`}
                        suppressHydrationWarning
                      />
                      {fieldErrors.name && <div className="invalid-feedback d-block">{fieldErrors.name}</div>}
                    </Form.Group>

                    {/* Email */}
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="email"
                        placeholder="Email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={loading}
                        className={`contact-input ${fieldErrors.email ? "is-invalid" : ""}`}
                        suppressHydrationWarning
                      />
                      {fieldErrors.email && <div className="invalid-feedback d-block">{fieldErrors.email}</div>}
                    </Form.Group>

                    {/* Subject */}
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        placeholder="Subjek"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        disabled={loading}
                        className={`contact-input ${fieldErrors.subject ? "is-invalid" : ""}`}
                        suppressHydrationWarning
                      />
                      {fieldErrors.subject && <div className="invalid-feedback d-block">{fieldErrors.subject}</div>}
                    </Form.Group>

                    {/* Message */}
                    <Form.Group className="mb-4">
                      <Form.Control
                        as="textarea"
                        rows={5}
                        placeholder="Mulai menulis pesan di sini"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        disabled={loading}
                        className={`contact-input ${fieldErrors.message ? "is-invalid" : ""}`}
                        suppressHydrationWarning
                      />
                      {fieldErrors.message && <div className="invalid-feedback d-block">{fieldErrors.message}</div>}
                    </Form.Group>

                  </FormContainer>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className={`kontak-button d-flex justify-content-center text-align-center ${
                      buttonStatus === "success"
                        ? "btn-success"
                        : buttonStatus === "error"
                        ? "btn-danger"
                        : ""
                    }`}
                    disabled={loading}
                    suppressHydrationWarning
                  >
                    {renderButtonText()}
                  </button>
                </Form>
              </Col>

              {/* Right Column - Contact Info */}
              <Col lg={6} className="contact-info-col">

                <div className="contact-info-text">
                  <p>
                    Apabila Kamu memiliki pertanyaan, saran, kerja sama ataupun ingin bergabung dalam komunitas, jangan
                    ragu untuk menghubungi kami. Kami siap memberikan informasi yang kamu butuhkan.
                  </p>
                </div>

                <div className="contact-info-items">
                  <div className="contact-info-item">
                    <div className="contact-icon">
                      <a href="https://wa.me/6285709346954" target="_blank" rel="noopener noreferrer">
                        <FaWhatsapp />
                      </a>
                    </div>
                    <div className="contact-detail">
                      <h5>Whatsapp</h5>
                      <p>0857-09346-954</p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="contact-icon">
                      <a href="https://www.instagram.com/hoklampung.official/" target="_blank" rel="noopener noreferrer">
                        <FaInstagram />
                      </a>
                    </div>
                    <div className="contact-detail">
                      <h5>Instagram</h5>
                      <p>hoklampung.official</p>
                    </div>
                  </div>

                  <div className="contact-info-item">
                    <div className="contact-icon-email">
                      <a
                        href="https://mail.google.com/mail/?view=cm&fs=1&to=hoklampung.official@gmail.com&su=kritik dan saran untuk hok lampung"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IoIosMail />
                      </a>
                    </div>
                    <div className="contact-detail">
                      <h5>Email</h5>
                      <p>hoklampung.official@gmail.com</p>
                    </div>
                  </div>
                </div>

              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default ContactFormComponent