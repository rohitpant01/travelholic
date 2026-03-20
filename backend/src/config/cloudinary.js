const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for profile/travel photos
const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'travelholic/photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 1000, crop: 'limit', quality: 'auto' }],
  },
});

// Storage for verification selfies
const selfieStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'travelholic/selfies',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

// Storage for voice messages
const voiceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'travelholic/voice',
    resource_type: 'video', // Audio is handled as 'video' in Cloudinary
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|m4a|aac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

const uploadSelfie = multer({
  storage: selfieStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Unified storage for chat (both image and voice)
const chatMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|m4a|aac)$/i);
    return {
      folder: isAudio ? 'travelholic/voice' : 'travelholic/photos',
      resource_type: isAudio ? 'video' : 'image',
      allowed_formats: isAudio ? undefined : ['jpg', 'jpeg', 'png', 'webp'],
    };
  },
});

const uploadChatMedia = multer({
  storage: chatMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

module.exports = { 
  cloudinary, 
  uploadPhoto, 
  uploadSelfie, 
  uploadVoice, 
  uploadChatMedia, // Exported for unified chat routes
  deleteImage 
};
