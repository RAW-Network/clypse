import chokidar from 'chokidar';
import path from 'path';
import * as fs from 'fs';
import fsp from 'fs/promises';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as videoService from './video.service.js';
import { addToQueue } from './queue.service.js';

export const initializeFileWatcher = () => {
  try {
    if (!fs.existsSync(config.paths.uploads)) fs.mkdirSync(config.paths.uploads, { recursive: true });
    if (!fs.existsSync(config.paths.videos)) fs.mkdirSync(config.paths.videos, { recursive: true });
    if (!fs.existsSync(config.paths.thumbnails)) fs.mkdirSync(config.paths.thumbnails, { recursive: true });
    logger.info('Ensured uploads, videos, and thumbnails directories exist.');
  } catch (err) {
    logger.error('FAILED_TO_CREATE_WATCHER_DIRS', { error: err.message });
    process.exit(1);
  }

  const uploadWatcher = chokidar.watch(config.paths.uploads, {
    ignored: [
        /(^|[\/\\])\../,
        /.*\.clypse-chunk\.\d+$/,
        /.*\.clypse-temp$/,
        /.*\.meta$/,
    ],
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
  });

  uploadWatcher
    .on('add', (filePath) => {
        logger.info('File detected in uploads directory.', { file: path.basename(filePath) });
        addToQueue(filePath);
    })
    .on('error', (error) => logger.error('UPLOAD_WATCHER_ERROR', { error: error.message }));

  const videoWatcher = chokidar.watch(config.paths.videos, {
    ignored: /(^|[\/\\])\..|.*[\/\\]thumbnails[\/\\].*/,
    persistent: true,
  });

  videoWatcher
    .on('unlink', (filePath) => videoService.deleteVideoData(path.basename(filePath)))
    .on('error', (error) => logger.error('VIDEO_WATCHER_ERROR', { error: error.message }));

  logger.info(`File watchers initialized.`);
};