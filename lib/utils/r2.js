import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

// Configure Cloudflare R2 Client (compatible with S3 API v3)
const r2Client = new S3Client({
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  region: "auto", // R2 uses 'auto' for region
  endpoint: process.env.R2_ENDPOINT, // https://<account_id>.r2.cloudflarestorage.com
})

export const uploadToR2 = async (file, folder = "gallery") => {
  console.log('R2 Upload - Received file object:', {
    hasName: !!file.name,
    hasType: !!file.type,
    hasSize: !!file.size,
    hasBuffer: !!file.buffer,
    bufferLength: file.buffer?.length,
    bufferIsBuffer: Buffer.isBuffer(file.buffer)
  });

  const fileExtension = file.name.split(".").pop()
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`

  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.type,
    // Optional: Set cache control for better CDN performance
    CacheControl: "public, max-age=31536000, immutable",
  }

  console.log('R2 Upload params:', {
    Bucket: params.Bucket,
    Key: params.Key,
    ContentType: params.ContentType,
    BodyType: typeof params.Body,
    BodyIsBuffer: Buffer.isBuffer(params.Body)
  });

  try {
    const command = new PutObjectCommand(params)
    await r2Client.send(command)

    // Construct public URL
    // Option 1: Custom Domain from env (recommended)
    let url
    if (process.env.R2_PUBLIC_URL) {
      url = `${process.env.R2_PUBLIC_URL}/${params.Key}`
    }
    // Option 2: Hardcoded custom domain (cdn.hoklampung.com)
    else {
      url = `https://cdn.hoklampung.com/${params.Key}`
    }

    console.log('R2 upload successful:', url);

    return {
      url: url,
      key: params.Key,
    }
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`R2 upload failed: ${error.message}`)
  }
}

export const deleteFromR2 = async (key) => {
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }

  try {
    const command = new DeleteObjectCommand(params)
    await r2Client.send(command)
    console.log('R2 delete successful:', key);
    return true
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new Error(`R2 delete failed: ${error.message}`)
  }
}

// Backward compatibility: export S3-named functions
export const uploadToS3 = uploadToR2
export const deleteFromS3 = deleteFromR2

export default r2Client