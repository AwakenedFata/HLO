import AWS from "aws-sdk"

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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
    Body: file.buffer, // ✅ FIXED: Use file.buffer instead of file
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
    const result = await s3.upload(params).promise()
    console.log('✅ S3 upload successful:', result.Location);
    return {
      url: result.Location,
      key: result.Key,
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
    await s3.deleteObject(params).promise()
    return true
  } catch (error) {
    throw new Error(`S3 delete failed: ${error.message}`)
  }
}

export default s3