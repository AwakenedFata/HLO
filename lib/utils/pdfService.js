/**
 * PDF Service Utilities
 * Utility functions untuk handle PDF generation di client dan server side
 */

/**
 * Generate PDF download URL dengan query parameters
 * @param {Object} data - Data untuk certificate
 * @returns {string} - URL untuk download PDF
 */
export function generatePdfUrl(data) {
  const params = new URLSearchParams();
  
  if (data.code) {
    params.set('code', String(data.code).toUpperCase());
  }
  
  if (data.issuedOn) {
    params.set('issuedOn', data.issuedOn);
  }
  
  if (data.product) {
    if (data.product.name) {
      params.set('name', encodeURIComponent(data.product.name));
    }
    if (data.product.batch) {
      params.set('batch', encodeURIComponent(data.product.batch));
    }
    if (data.product.productionDate) {
      params.set('productionDate', encodeURIComponent(data.product.productionDate));
    }
    if (data.product.warrantyUntil) {
      params.set('warrantyUntil', encodeURIComponent(data.product.warrantyUntil));
    }
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${baseUrl}/api/verification-pdf?${params.toString()}`;
}

/**
 * Download PDF via client-side fetch
 * @param {string} url - PDF download URL
 * @param {string} filename - Nama file untuk download
 * @returns {Promise<void>}
 */
export async function downloadPdf(url, filename = 'certificate.pdf') {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`PDF download failed: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
    return { success: true };
  } catch (error) {
    console.error('PDF download error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate PDF via POST request (untuk data kompleks)
 * @param {Object} data - Data untuk certificate
 * @returns {Promise<Blob>}
 */
export async function generatePdfBlob(data) {
  try {
    const response = await fetch('/api/verification-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `PDF generation failed: ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}

/**
 * Validate certificate data sebelum generate PDF
 * @param {Object} data - Data untuk validate
 * @returns {Object} - Validation result
 */
export function validateCertificateData(data) {
  const errors = [];
  
  if (!data.code) {
    errors.push('Serial code is required');
  } else if (!/^[A-Z0-9-]{1,24}$/i.test(data.code)) {
    errors.push('Invalid serial code format');
  }
  
  if (data.issuedOn) {
    const date = new Date(data.issuedOn);
    if (isNaN(date.getTime())) {
      errors.push('Invalid issued date format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format date untuk display
 * @param {string|Date} date - Date untuk format
 * @param {string} locale - Locale format (default: 'en-GB')
 * @returns {string}
 */
export function formatDate(date, locale = 'en-GB') {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Generate safe filename
 * @param {string} code - Serial code
 * @param {string} prefix - Filename prefix
 * @returns {string}
 */
export function generateFilename(code, prefix = 'certificate') {
  const sanitized = String(code || '')
    .replace(/[^a-z0-9_\-.]+/gi, '_')
    .slice(0, 20);
  
  return sanitized 
    ? `${prefix}-${sanitized}.pdf`
    : `${prefix}.pdf`;
}

/**
 * Check if PDF generation is available (server-side check)
 * @returns {Promise<boolean>}
 */
export async function checkPdfServiceHealth() {
  try {
    const response = await fetch('/api/verification-pdf/health', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Batch PDF generation (untuk multiple certificates)
 * @param {Array} dataList - Array of certificate data
 * @returns {Promise<Array>} - Array of blob results
 */
export async function batchGeneratePdf(dataList) {
  const results = [];
  
  // Process in chunks untuk avoid rate limiting
  const CHUNK_SIZE = 3;
  const DELAY_BETWEEN_CHUNKS = 1000; // 1 second
  
  for (let i = 0; i < dataList.length; i += CHUNK_SIZE) {
    const chunk = dataList.slice(i, i + CHUNK_SIZE);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(data => generatePdfBlob(data))
    );
    
    results.push(...chunkResults);
    
    // Delay sebelum process chunk berikutnya
    if (i + CHUNK_SIZE < dataList.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
    }
  }
  
  return results;
}

/**
 * Create download link dari blob
 * @param {Blob} blob - PDF blob
 * @param {string} filename - Download filename
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Open PDF in new tab
 * @param {Blob} blob - PDF blob
 */
export function openPdfInNewTab(blob) {
  const url = window.URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  
  // Cleanup after window loads
  if (newWindow) {
    newWindow.onload = () => {
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    };
  }
}

// Export default object dengan semua functions
export default {
  generatePdfUrl,
  downloadPdf,
  generatePdfBlob,
  validateCertificateData,
  formatDate,
  generateFilename,
  checkPdfServiceHealth,
  batchGeneratePdf,
  downloadBlob,
  openPdfInNewTab,
};