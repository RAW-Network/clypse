import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { parseSize, formatSize } from '../utils/parseSize.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..', '..');

const IS_DOCKER = fs.existsSync('/data');
const dataPath = IS_DOCKER ? '/data' : path.join(ROOT_DIR, 'data');
const uploadsPath = IS_DOCKER ? '/uploads' : path.join(ROOT_DIR, 'uploads');
const videosPath = IS_DOCKER ? '/videos' : path.join(ROOT_DIR, 'videos');

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
    data: path.resolve(dataPath),
    uploads: path.resolve(uploadsPath),
    videos: path.resolve(videosPath),
    thumbnails: path.resolve(videosPath, 'thumbnails'),
    database: path.resolve(dataPath, 'clypse.db'),
  },
  allowedVideoExtensions: new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm']),
};

export default config;