const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

// Uses the IAM Role attached to the EC2 instance - no access keys needed
// when deployed on AWS (the SDK auto-discovers instance credentials).
// For local dev, set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env.
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET = process.env.S3_BUCKET_NAME;

async function uploadFile(fileBuffer, fileName, mimeType) {
  const key = `uploads/${Date.now()}-${fileName}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  }));
  const fileUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  logger.info('File uploaded to S3', { key });
  return fileUrl;
}

module.exports = { uploadFile };
