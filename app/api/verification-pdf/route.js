import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import CertificatePDFDocument from '@/components/pdf/CertificatePDFDocument';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limiting configuration (optional - implementasi menggunakan Redis/Memory)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 menit
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map();

/**
 * Simple in-memory rate limiter
 * Untuk production, gunakan Redis atau rate limiting service
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  
  // Filter request dalam window yang valid
  const validRequests = userRequests.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  
  // Cleanup old entries (garbage collection)
  if (rateLimitMap.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW;
    for (const [key, requests] of rateLimitMap.entries()) {
      const valid = requests.filter(t => t > cutoff);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, valid);
      }
    }
  }
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - validRequests.length,
  };
}

/**
 * Validate query parameters
 */
function validateParams(searchParams) {
  const code = String(searchParams.get('code') || '').toUpperCase();
  const issuedOn = searchParams.get('issuedOn');
  
  // Validate code format
  if (code && !/^[A-Z0-9-]{1,24}$/.test(code)) {
    return {
      valid: false,
      status: 400,
      message: 'Invalid code format. Code must be alphanumeric (1-24 characters).',
    };
  }
  
  // Validate date format
  if (issuedOn) {
    const date = new Date(issuedOn);
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        status: 400,
        message: 'Invalid issuedOn date format.',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Sanitize filename untuk mencegah path traversal
 */
function sanitizeFileName(name) {
  return String(name || 'certificate')
    .replace(/[^a-z0-9_\-.]+/gi, '_')
    .slice(0, 80);
}

/**
 * GET handler untuk generate PDF
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Rate limiting check
    const clientIP = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
    
    // Validate parameters
    const validation = validateParams(searchParams);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: validation.status }
      );
    }
    
    // Extract and decode parameters
    const code = String(searchParams.get('code') || '').toUpperCase();
    const issuedOn = searchParams.get('issuedOn') 
      ? decodeURIComponent(searchParams.get('issuedOn'))
      : new Date().toISOString();
    
    const product = {
      name: searchParams.get('name') 
        ? decodeURIComponent(searchParams.get('name')) 
        : '-',
      batch: searchParams.get('batch')
        ? decodeURIComponent(searchParams.get('batch'))
        : '-',
      productionDate: searchParams.get('productionDate')
        ? decodeURIComponent(searchParams.get('productionDate'))
        : '-',
      warrantyUntil: searchParams.get('warrantyUntil')
        ? decodeURIComponent(searchParams.get('warrantyUntil'))
        : '-',
    };
    
    console.log('[PDF Generator] Generating certificate for code:', code);
    
    // Render PDF Document
    const pdfStream = await renderToStream(
      <CertificatePDFDocument
        serialNumber={code}
        issuedOn={issuedOn}
        product={product}
      />
    );
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of pdfStream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    
    const generationTime = Date.now() - startTime;
    console.log(`[PDF Generator] ✓ PDF generated in ${generationTime}ms`);
    
    // Generate filename
    const fileName = sanitizeFileName(
      code ? `certificate-${code}.pdf` : 'certificate-of-authenticity.pdf'
    );
    
    // Return PDF dengan proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        'X-Generation-Time': `${generationTime}ms`,
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
    
  } catch (error) {
    console.error('[PDF Generator] ✗ Error:', error);
    
    const generationTime = Date.now() - startTime;
    
    // Handle specific errors
    let statusCode = 500;
    let errorMessage = 'Failed to generate PDF certificate';
    
    if (error.code === 'ENOENT') {
      statusCode = 404;
      errorMessage = 'Required assets not found';
    } else if (error.message?.includes('font')) {
      statusCode = 500;
      errorMessage = 'Font loading error';
    } else if (error.message?.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'PDF generation timeout';
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
        generationTime: `${generationTime}ms`,
      },
      { 
        status: statusCode,
        headers: {
          'X-Generation-Time': `${generationTime}ms`,
        },
      }
    );
  }
}

/**
 * POST handler untuk generate PDF dengan body data
 * Berguna untuk data yang lebih kompleks
 */
export async function POST(request) {
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const clientIP = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { code, issuedOn, product } = body;
    
    // Validate code
    if (code && !/^[A-Z0-9-]{1,24}$/.test(String(code).toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }
    
    console.log('[PDF Generator] Generating certificate for code:', code);
    
    // Render PDF Document
    const pdfStream = await renderToStream(
      <CertificatePDFDocument
        serialNumber={code}
        issuedOn={issuedOn || new Date().toISOString()}
        product={product || {}}
      />
    );
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of pdfStream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    
    const generationTime = Date.now() - startTime;
    console.log(`[PDF Generator] ✓ PDF generated in ${generationTime}ms`);
    
    // Generate filename
    const fileName = sanitizeFileName(
      code ? `certificate-${code}.pdf` : 'certificate-of-authenticity.pdf'
    );
    
    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        'X-Generation-Time': `${generationTime}ms`,
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
    
  } catch (error) {
    console.error('[PDF Generator] ✗ Error:', error);
    
    const generationTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        error: 'Failed to generate PDF certificate',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
        generationTime: `${generationTime}ms`,
      },
      { 
        status: 500,
        headers: {
          'X-Generation-Time': `${generationTime}ms`,
        },
      }
    );
  }
}