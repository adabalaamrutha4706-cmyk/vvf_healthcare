import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const uploadBaseDir = path.join(__dirname, '../../uploads/visits');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Generate date string for structured directory: YYYY-MM-DD
    const dateStr = new Date().toISOString().split('T')[0];
    const targetDir = path.join(uploadBaseDir, dateStr);

    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP formats are allowed.'));
  }
};

const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024; // Default 5MB
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});

const profileUploadDir = path.join(__dirname, '../../uploads/profiles');

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create directory if it doesn't exist
    if (!fs.existsSync(profileUploadDir)) {
      fs.mkdirSync(profileUploadDir, { recursive: true });
    }
    cb(null, profileUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

export const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});
