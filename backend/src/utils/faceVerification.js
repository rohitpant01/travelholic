const AWS = require('aws-sdk');

// ================================================================
// AWS REKOGNITION SETUP
// Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION to .env
// ================================================================
const rekognition = new AWS.Rekognition({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Compare selfie with profile photo using AWS Rekognition
 * Returns similarity score (0-100)
 */
const compareFaces = async (sourceImageUrl, targetImageUrl) => {
  try {
    // For Cloudinary URLs we use URL-based comparison
    // AWS Rekognition works with S3 or raw image bytes
    // Here we fetch and convert to buffer

    const fetch = require('node-fetch');

    const [sourceRes, targetRes] = await Promise.all([
      fetch(sourceImageUrl),
      fetch(targetImageUrl),
    ]);

    const sourceBuffer = await sourceRes.buffer();
    const targetBuffer = await targetRes.buffer();

    const params = {
      SourceImage: { Bytes: sourceBuffer },
      TargetImage: { Bytes: targetBuffer },
      SimilarityThreshold: 70,
    };

    const result = await rekognition.compareFaces(params).promise();

    if (!result.FaceMatches || result.FaceMatches.length === 0) {
      return { verified: false, similarity: 0 };
    }

    const similarity = result.FaceMatches[0].Similarity;
    return {
      verified: similarity >= 80,
      similarity: Math.round(similarity),
    };
  } catch (error) {
    console.error('Face comparison error:', error.message);
    // Don't block registration if verification fails - mark as unverified
    return { verified: false, similarity: 0, error: error.message };
  }
};

module.exports = { compareFaces };
