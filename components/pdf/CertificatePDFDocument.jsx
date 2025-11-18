import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Register custom fonts (pastikan font files ada di folder public)
Font.register({
  family: 'Bahnschrift',
  src: '/fonts/BAHNSCHRIFT.TTF',
});

Font.register({
  family: 'Corrupted File',
  src: '/fonts/CORRUPTED FILE.TTF',
});

// Styles menggunakan React PDF StyleSheet
const styles = StyleSheet.create({
  page: {
    width: '210mm',
    height: '297mm',
    backgroundColor: '#ffffff',
    fontFamily: 'Bahnschrift',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: -1,
  },
  container: {
    padding: '0 50px',
    paddingTop: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 45,
  },
  logo: {
    height: 44,
    width: 'auto',
  },
  divider: {
    width: 2.5,
    height: 48,
    backgroundColor: '#da1b1b',
  },
  title: {
    fontSize: 15.5,
    textAlign: 'center',
    fontWeight: 600,
    marginBottom: 22,
  },
  paragraph: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 1.4,
    marginBottom: 22,
    paddingHorizontal: 50,
  },
  bold: {
    fontWeight: 700,
  },
  line: {
    width: '370px',
    height: 2,
    backgroundColor: '#000000',
    marginVertical: 25,
    marginHorizontal: 'auto',
  },
  serialSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginVertical: 30,
  },
  serialLabel: {
    fontSize: 15.5,
    fontWeight: 700,
  },
  serialNumber: {
    fontFamily: 'Corrupted File',
    fontSize: 20,
    color: '#da1b1b',
  },
  infoSection: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 42,
  },
  infoRow: {
    marginBottom: 8,
  },
  signatureSection: {
    position: 'relative',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  signature: {
    width: 238,
    height: 'auto',
  },
  stamp: {
    position: 'absolute',
    width: 96,
    height: 'auto',
    bottom: -20,
    right: 268,
    transform: 'rotate(-20deg)',
  },
  footer: {
    position: 'absolute',
    bottom: 145,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 1.4,
  },
  footerLine: {
    width: '370px',
    height: 2,
    backgroundColor: '#000000',
    marginVertical: 20,
    marginHorizontal: 'auto',
  },
});

const CertificatePDFDocument = ({ serialNumber = '', issuedOn = '', product = {} }) => {
  // Format serial number dengan padding
  const safeSerial = String(serialNumber || '').trim();
  const serialToShow = safeSerial.padStart(6, '0');

  // Format tanggal issued
  let issuedOnString = '—';
  try {
    if (issuedOn) {
      const d = new Date(issuedOn);
      if (!isNaN(d.getTime())) {
        issuedOnString = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }
  } catch (e) {
    console.error('Date parsing error:', e);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Background Image */}
        <Image
          src="/assets/serialnumber/Surat Originalitas background.png"
          style={styles.backgroundImage}
        />

        <View style={styles.container}>
          {/* Header dengan Logo */}
          <View style={styles.header}>
            <Image src="/assets/serialnumber/HLO ID 2.png" style={styles.logo} />
            <View style={styles.divider} />
            <Image src="/assets/serialnumber/logo hok.png" style={styles.logo} />
          </View>

          {/* Title */}
          <Text style={styles.title}>CERTIFICATE OF AUTHENTICITY</Text>

          {/* Paragraf 1 */}
          <Text style={styles.paragraph}>
            This document verifies that the item associated with the serial number below{'\n'}
            is an <Text style={styles.bold}>authentic and original product of HLO</Text>.
          </Text>

          {/* Paragraf 2 */}
          <Text style={styles.paragraph}>
            Each certified piece represents the brand's dedication to craftsmanship,{'\n'}
            detail, and originality — no reproductions, no replicas, no compromises.
          </Text>

          <View style={styles.line} />

          {/* Serial Number Section */}
          <View style={styles.serialSection}>
            <Text style={styles.serialLabel}>SERIAL NUMBER:</Text>
            <Text style={styles.serialNumber}>{serialToShow}</Text>
          </View>

          <View style={styles.line} />

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text>
                <Text style={styles.bold}>Issued by:</Text> HLO STORE ID
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text>
                <Text style={styles.bold}>Issued on:</Text> {issuedOnString}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text>
                <Text style={styles.bold}>Location:</Text> Lampung, Indonesia
              </Text>
            </View>
          </View>

          <View style={styles.line} />

          {/* Paragraf 3 */}
          <Text style={styles.paragraph}>
            This certificate confirms that the product listed under the serial number above{'\n'}
            has been reviewed, approved, and released under the supervision of{'\n'}
            <Text style={styles.bold}>HLO's Authenticity & Quality Control Division.</Text>
          </Text>

          {/* Paragraf 4 */}
          <Text style={styles.paragraph}>
            Any duplication, modification, or reproduction of this certificate{'\n'}
            is strictly prohibited and will void its authenticity status.
          </Text>

          <View style={styles.line} />

          {/* Signature Label */}
          <Text style={[styles.paragraph, { marginBottom: 0 }]}>
            <Text style={styles.bold}>Authorized Signature & Official Seal</Text>
          </Text>

          {/* Signature & Stamp */}
          <View style={styles.signatureSection}>
            <Image src="/assets/serialnumber/ttd.png" style={styles.signature} />
            <Image src="/assets/serialnumber/stamp.png" style={styles.stamp} />
          </View>

          <View style={styles.line} />

          {/* Footer */}
          <View style={styles.footer}>
            <Text>© 2025 HLO</Text>
            <Text>All Rights Reserved Worldwide</Text>
            <Text>www.hoklampung.com</Text>
          </View>

          <View style={[styles.line, { marginTop: 105 }]} />
        </View>
      </Page>
    </Document>
  );
};

export default CertificatePDFDocument;