"use client";

import { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import Link from "next/link";
import Image from "next/image";
import { IoLogoInstagram } from "react-icons/io5";
import { FaWhatsapp, FaFacebookF, FaTelegramPlane } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { GoMail } from "react-icons/go";
import { TfiEmail } from "react-icons/tfi";

function FooterComponent() {
  const [currentYear, setCurrentYear] = useState(2023);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const handleSubscribe = async () => {
    if (!email) {
      setStatus("Email tidak boleh kosong.");
      return;
    }

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setStatus(data.message || data.error);
      setEmail("");
    } catch (error) {
      setStatus("Terjadi kesalahan. Coba lagi.");
    }
  };

  return (
    <footer className="footer">
      <Container>
        {/* Main Footer Content */}
        <Row className="main-footer-row">
          {/* Left Column - Logo and Newsletter */}
          <Col lg={4} md={12} className="footer-left-col">
            <div className="footer-logo-container">
              <Image
                src="/assets/newlogowhite.avif"
                alt="HOK Lampung Community"
                className="footer-logo"
                width={80}
                height={80}
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
            <p className="footer-text">
              Jangan lewatkan info terbaru seputar event, turnamen, dan kabar
              menarik dari HOK Lampung! Masukkan email kamu untuk tetap
              terhubung bersama komunitas kami.
            </p>
            <div className="newsletter-form">
              <div className="input-group">
                <input
                  type="email"
                  className="form-control"
                  placeholder="Submit email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  suppressHydrationWarning
                />
                <button
                  className="btn btn-submit"
                  type="button"
                  onClick={handleSubscribe}
                  suppressHydrationWarning
                >
                  <GoMail />
                </button>
              </div>
              {status && <p className="mt-2">{status}</p>}
            </div>
          </Col>

          {/* Middle Column - About Links */}
          <Col lg={2} md={4} sm={6} className="footer-col">
            <h5 className="footer-heading">About</h5>
            <ul className="footer-links">
              <li>
                <Link href="/#community">Tentang Kami</Link>
              </li>
              <li>
                <Link href="/aboutus/maknalogo">Profile Logo</Link>
              </li>
              <li>
                <Link href="/#partners">Partner & Sponsor</Link>
              </li>
              <li>
                <Link href="/#contact-us">Bantuan & Dukungan</Link>
              </li>
            </ul>
          </Col>

          {/* Middle Column - Service Links */}
          <Col lg={2} md={4} sm={6} className="footer-col">
            <h5 className="footer-heading">Service</h5>
            <ul className="footer-links">
              <li>
                <a
                  href="https://whatsapp.com/channel/0029Vb7zKjz1SWt5WHmcWB31"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Event & Turnamen
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/6285709346954"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Daftar Member
                </a>
              </li>
              <li>
                <a
                  href="https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Forum Diskusi
                </a>
              </li>
              <li>
                <Link href="/gallery">Gallery</Link>
              </li>
            </ul>
          </Col>

          {/* Right Column - Contact Info */}
          <Col lg={4} md={4} sm={12} className="footer-col">
            <h5 className="footer-heading">Contact</h5>
            <ul className="contact-info-footer">
              <li>
                <div className="contact-icon-footer whatsapp-icon">
                  <a
                    href="https://wa.me/6285709346954"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaWhatsapp />
                  </a>
                </div>
                <div className="contact-details-footer">
                  <p>+62 857-0934-6954</p>
                </div>
              </li>
              <li>
                <div className="contact-icon-footer instagram-icon">
                  <a
                    href="https://www.instagram.com/hoklampung.official/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IoLogoInstagram />
                  </a>
                </div>
                <div className="contact-details-footer">
                  <p>hoklampung.official</p>
                </div>
              </li>
              <li>
                <div className="contact-icon-footer email-icon">
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=hoklampung.official@gmail.com&su=kritik dan saran untuk hok lampung&body=kritik dan saran untuk hok lampung"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TfiEmail />
                  </a>
                </div>
                <div className="contact-details-footer">
                  <p>hoklampung.official@gmail.com</p>
                </div>
              </li>
            </ul>
          </Col>
        </Row>

        {/* Social Media Links and Copyright */}
        <Row className="bottom-footer-row">
          <Col lg={6} md={12} className="social-media-col">
            <div className="social-media-container-footer">
              <span className="follow-us-footer">Follow Us</span>
              <div className="social-icons-footer">
                <a
                  href="https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaWhatsapp />
                </a>
                <a
                  href="https://www.instagram.com/hoklampung.official/"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IoLogoInstagram />
                </a>
                <a
                  href="https://twitter.com/honorofkings"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaXTwitter />
                </a>
                <a
                  href="https://www.facebook.com/honorofkings.og.id"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaFacebookF />
                </a>
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=hoklampung.official@gmail.com"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TfiEmail />
                </a>
                <a
                  href="https://t.me/honorofkings_id"
                  className="social-icon-footer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaTelegramPlane />
                </a>
              </div>
            </div>
          </Col>
          <Col lg={6} md={12} className="copyright-col">
            <div className="copyright-text">
              <p>
                All rights reserved &copy; HOK Lampung Community {currentYear}
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default FooterComponent;
