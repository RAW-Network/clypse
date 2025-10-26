import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { parseSize, formatSize } from '../utils/parseSize.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const maxUploadSizeValue = process.env.MAX_UPLOAD_SIZE;
const maxUploadCountValue = parseInt(process.env.MAX_UPLOAD_COUNT, 10);

const config = {
  port: process.env.PORT || 3000,
  timezone: process.env.TZ || 'UTC',
  maxUploadSize: parseSize(maxUploadSizeValue),
  maxUploadSizeString: formatSize(parseSize(maxUploadSizeValue)),
  maxUploadCount: !isNaN(maxUploadCountValue) && maxUploadCountValue > 0 ? maxUploadCountValue : Infinity,
  paths: {
    root: ROOT_DIR,
    public: path.join(ROOT_DIR, 'public'),
    data: path.join(ROOT_DIR, 'data'),
    uploads: path.join(ROOT_DIR, 'uploads'),
    videos: path.join(ROOT_DIR, 'videos'),
    thumbnails: path.join(ROOT_DIR, 'videos', 'thumbnails'),
    database: path.join(ROOT_DIR, 'data', 'clypse.db'),
  },
  allowedVideoExtensions: new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm']),
};

export default config;