import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { 
  MediaType, 
  MediaMetadata, 
  MediaValidationResult,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  SUPPORTED_GIF_TYPES,
  MAX_FILE_SIZE
} from '../types/media.types';

class MediaService {
  private static UPLOAD_DIR = 'uploads';
  private static THUMBNAIL_SIZE = { width: 200, height: 200 };

  // Initialize storage directories
  static initStorage() {
    const dirs = [
      this.UPLOAD_DIR,
      path.join(this.UPLOAD_DIR, 'images'),
      path.join(this.UPLOAD_DIR, 'videos'),
      path.join(this.UPLOAD_DIR, 'gifs'),
      path.join(this.UPLOAD_DIR, 'thumbnails')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Configure multer storage
  static storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let type = 'images';
      if (file.mimetype === 'video/mp4') {
        type = 'videos';
      } else if (file.mimetype === 'image/gif') {
        type = 'gifs';
      }
      cb(null, path.join(this.UPLOAD_DIR, type));
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });

  // Configure multer upload
  static upload = multer({
    storage: this.storage,
    fileFilter: (req, file, cb) => {
      const isValid = this.validateFileType(file.mimetype);
      if (!isValid) {
        cb(new Error('Invalid file type'));
        return;
      }
      cb(null, true);
    },
    limits: {
      fileSize: Math.max(MAX_FILE_SIZE.image, MAX_FILE_SIZE.video, MAX_FILE_SIZE.gif)
    }
  });

  // Validate file type
  private static validateFileType(mimeType: string): boolean {
    return (
      SUPPORTED_IMAGE_TYPES.includes(mimeType) ||
      SUPPORTED_VIDEO_TYPES.includes(mimeType) ||
      SUPPORTED_GIF_TYPES.includes(mimeType)
    );
  }

  // Get file type
  private static getFileType(mimeType: string): MediaType {
    if (mimeType === 'image/gif') {
      return MediaType.GIF;
    }
    return mimeType.startsWith('image/') ? MediaType.IMAGE : MediaType.VIDEO;
  }

  // Process GIF
  static async processGif(filePath: string): Promise<MediaMetadata> {
    const metadata = await sharp(filePath, { animated: true }).metadata();
    
    // Create thumbnail from first frame
    const thumbnailName = `thumb_${path.basename(filePath)}`;
    const thumbnailPath = path.join(this.UPLOAD_DIR, 'thumbnails', thumbnailName);
    
    await sharp(filePath, { animated: true })
      .resize(this.THUMBNAIL_SIZE.width, this.THUMBNAIL_SIZE.height, {
        fit: 'cover',
        position: 'center'
      })
      .toFormat('png')  // Convert to PNG for thumbnail
      .toFile(thumbnailPath);

    return {
      width: metadata.width,
      height: metadata.height,
      size_in_bytes: metadata.size || 0,
      mime_type: 'image/gif'
    };
  }

  // Process image
  static async processImage(filePath: string): Promise<MediaMetadata> {
    const metadata = await sharp(filePath).metadata();
    
    // Create thumbnail
    const thumbnailName = `thumb_${path.basename(filePath)}`;
    const thumbnailPath = path.join(this.UPLOAD_DIR, 'thumbnails', thumbnailName);
    
    await sharp(filePath)
      .resize(this.THUMBNAIL_SIZE.width, this.THUMBNAIL_SIZE.height, {
        fit: 'cover',
        position: 'center'
      })
      .toFile(thumbnailPath);

    return {
      width: metadata.width,
      height: metadata.height,
      size_in_bytes: metadata.size || 0,
      mime_type: metadata.format || 'unknown'
    };
  }

  // Process video
  static async processVideo(filePath: string): Promise<MediaMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const { width, height, duration } = metadata.streams[0];
        const size = fs.statSync(filePath).size;

        // Generate thumbnail
        const thumbnailName = `thumb_${path.basename(filePath)}.jpg`;

        ffmpeg(filePath)
          .screenshots({
            timestamps: ['1'],
            filename: thumbnailName,
            folder: path.join(this.UPLOAD_DIR, 'thumbnails'),
            size: `${this.THUMBNAIL_SIZE.width}x${this.THUMBNAIL_SIZE.height}`
          })
          .on('end', () => {
            resolve({
              width,
              height,
              duration: duration ? parseInt(duration) : undefined,
              size_in_bytes: size,
              mime_type: 'video/mp4'
            });
          })
          .on('error', reject);
      });
    });
  }

  // Validate and process uploaded file
  static async validateAndProcessFile(file: Express.Multer.File): Promise<MediaValidationResult> {
    try {
      // Check file presence
      if (!file) {
        return {
          isValid: false,
          errors: [{ field: 'file', message: 'No file uploaded' }]
        };
      }

      // Validate file type
      if (!this.validateFileType(file.mimetype)) {
        return {
          isValid: false,
          errors: [{ field: 'file', message: 'Unsupported file type' }]
        };
      }

      // Validate file size
      let maxSize = MAX_FILE_SIZE.image;
      if (file.mimetype === 'video/mp4') {
        maxSize = MAX_FILE_SIZE.video;
      } else if (file.mimetype === 'image/gif') {
        maxSize = MAX_FILE_SIZE.gif;
      }

      if (file.size > maxSize) {
        return {
          isValid: false,
          errors: [{ field: 'file', message: 'File size exceeds limit' }]
        };
      }

      // Process file based on type
      let metadata;
      if (file.mimetype === 'image/gif') {
        metadata = await this.processGif(file.path);
      } else if (file.mimetype.startsWith('image/')) {
        metadata = await this.processImage(file.path);
      } else {
        metadata = await this.processVideo(file.path);
      }

      return {
        isValid: true,
        errors: [],
        metadata
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'file', message: 'File processing failed' }]
      };
    }
  }

  // Delete file and its thumbnail
  static async deleteFile(filePath: string, thumbnailPath?: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  // Format file size for display
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  }
}

// Initialize storage on service import
MediaService.initStorage();

export default MediaService; 