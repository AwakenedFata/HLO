import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

// Configure AWS S3 Client (v3)
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
})

export const uploadToS3 = async (file, folder = "gallery") => {
  console.log('📤 S3 Upload - Received file object:', {
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
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.type,
  }

  console.log('📋 S3 Upload params:', {
    Bucket: params.Bucket,
    Key: params.Key,
    ContentType: params.ContentType,
    BodyType: typeof params.Body,
    BodyIsBuffer: Buffer.isBuffer(params.Body)
  });

  try {
    const command = new PutObjectCommand(params)
    await s3Client.send(command)
    
    // Construct URL manually since v3 doesn't return Location
    const url = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`
    
    console.log('✅ S3 upload successful:', url);
    
    return {
      url: url,
      key: params.Key,
    }
  } catch (error) {
    console.error('💥 S3 upload error:', error);
    throw new Error(`S3 upload failed: ${error.message}`)
  }
}

export const deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  }

  try {
    const command = new DeleteObjectCommand(params)
    await s3Client.send(command)
    return true
  } catch (error) {
    throw new Error(`S3 delete failed: ${error.message}`)
  }
}

export default s3Client
lmasd