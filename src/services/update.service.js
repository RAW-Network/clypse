import { execFile } from 'child_process';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as videoService from './video.service.js';
import { broadcast } from './websocket.service.js';
import ApiError from '../utils/ApiError.js';
import { escapeHtml } from '../utils/escape.js';

const execFilePromise = util.promisify(execFile);
const processingQueue = [];
let isProcessing = false;

const FFMPEG_TIMEOUT = 5 * 60 * 1000;

const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
};

const getUniqueFileName = async (fileName) => {
    let finalName = fileName;
    let counter = 1;
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    let existsOnDisk = fs.existsSync(path.join(config.paths.videos, finalName));
    let existsInDb = await videoService.findVideoByFilename(finalName);

    while (existsOnDisk || existsInDb) {
        finalName = `${base} (${counter++})${ext}`;
        existsOnDisk = fs.existsSync(path.join(config.paths.videos, finalName));
        existsInDb = await videoService.findVideoByFilename(finalName);
    }
    return finalName;
};

const getFileMetadata = async (filePath) => {
  try {
    const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', filePath];
    const { stdout } = await execFilePromise('ffprobe', args, { timeout: FFMPEG_TIMEOUT });
    const result = JSON.parse(stdout);
    const stream = result.streams[0];
    return {
      width: stream ? stream.width : 1280,
      height: stream ? stream.height : 720,
      duration: stream && stream.duration ? parseFloat(stream.duration) : 0,
    };
  } catch (error) {
    logger.error('FFPROBE_ERROR', { error: error.message, file: filePath });
    throw new Error('Failed to get video metadata.');
  }
};

const generateThumbnail = async (filePath, thumbnailDir, thumbnailFilename, duration) => {
  const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
  const attemptTimestamps = ['00:00:01.000'];
  if (duration > 5) attemptTimestamps.push('00:00:05.000');
  if (duration > 10) attemptTimestamps.push(new Date(duration * 1000 * 0.1).toISOString().substr(11, 12));
  
  for (const timestamp of attemptTimestamps) {
    try {
      const args = ['-ss', timestamp, '-i', filePath, '-vframes', '1', '-s', '320x180', '-y', thumbnailPath];
      await execFilePromise('ffmpeg', args, { timeout: FFMPEG_TIMEOUT });
      
      const stats = fs.statSync(thumbnailPath);
      if (stats.size > 0) {
        return;
      }
    } catch (error) {
      logger.warn('FFMPEG_THUMBNAIL_ATTEMPT_FAILED', { error: error.message, file: filePath, timestamp });
    }
  }

  logger.error('FFMPEG_ERROR', { file: filePath, message: 'All thumbnail generation attempts failed.' });
  throw new Error('Failed to generate a valid thumbnail.');
};

const scanFile = async (filePath) => {
  logger.info(`Scanning file: ${filePath}`);
  await new Promise(resolve => setTimeout(resolve, 100));
  logger.info(`Scan complete for file: ${filePath}`);
};

const processUploadedFile = async (tempFilePath, originalFileName) => {
  try {
    if (!fs.existsSync(tempFilePath)) {
        logger.warn('File not found for processing, it may have been moved or deleted.', { file: tempFilePath });
        return;
    }

    if (!config.allowedVideoExtensions.has(path.extname(originalFileName).toLowerCase())) {
        logger.warn('Invalid file type, deleting.', { file: originalFileName });
        await fs.promises.unlink(tempFilePath);
        return;
    }

    await scanFile(tempFilePath);

    const sanitizedName = sanitizeFilename(originalFileName);
    const uniqueFileName = await getUniqueFileName(sanitizedName);
    const finalVideoPath = path.join(config.paths.videos, uniqueFileName);

    await fs.promises.rename(tempFilePath, finalVideoPath);
    
    const metadata = await getFileMetadata(finalVideoPath);
    
    const videoBasename = path.basename(uniqueFileName, path.extname(uniqueFileName));
    const thumbnailFilename = `${videoBasename}.png`;
    
    await generateThumbnail(finalVideoPath, config.paths.thumbnails, thumbnailFilename, metadata.duration);

    const titleBasis = path.basename(originalFileName, path.extname(originalFileName));
    const rawTitle = titleBasis.replace(/_/g, ' ');
    const videoTitle = escapeHtml(rawTitle);

    const videoData = {
      title: videoTitle,
      fileName: uniqueFileName,
      originalFileName: originalFileName,
      thumbnailFilename: thumbnailFilename,
      ...metadata
    };

    const newVideoEntry = await videoService.createVideoEntry(videoData);
    broadcast({ type: 'video:added', payload: newVideoEntry });
    logger.info(`Successfully processed and added video.`, { uuid: newVideoEntry.uuid, title: newVideoEntry.title });
  } catch (error) {
    logger.error('FILE_PROCESSING_ERROR', { file: originalFileName, error: error.message });
    if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(e => logger.error('FAILED_TO_CLEANUP_FAILED_UPLOAD', { file: tempFilePath, error: e.message }));
    }
  }
};

const removeFile = async (fileName) => {
  logger.info(`File removal detected.`, { file: fileName });
  try {
    const removedUuid = await videoService.deleteVideoByFilename(fileName);
    if (removedUuid) {
      const videoBasename = path.basename(fileName, path.extname(fileName));
      const thumbnailPath = path.join(config.paths.thumbnails, `${videoBasename}.png`);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);

      broadcast({ type: 'video:deleted', payload: { uuid: removedUuid } });
      logger.info(`Successfully removed video entry.`, { uuid: removedUuid });
    }
  } catch (error) {
    logger.error('FILE_REMOVAL_ERROR', { file: fileName, error: error.message });
  }
};

const addToQueue = (filePath) => {
    if (!processingQueue.some(item => item.filePath === filePath)) {
        const originalFileName = path.basename(filePath);
        processingQueue.push({ filePath, originalFileName });
        logger.info('File added to processing queue.', { file: originalFileName, queueSize: processingQueue.length });
        processQueue();
    }
};

export const processQueue = async () => {
    if (isProcessing || processingQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const { filePath, originalFileName } = processingQueue.shift();

    logger.info(`Processing file from queue: ${originalFileName}`);
    await processUploadedFile(filePath, originalFileName);

    isProcessing = false;
    setImmediate(processQueue);
};

export const initializeFileWatcher = () => {
  if (!fs.existsSync(config.paths.uploads)) fs.mkdirSync(config.paths.uploads, { recursive: true });
  if (!fs.existsSync(config.paths.videos)) fs.mkdirSync(config.paths.videos, { recursive: true });
  if (!fs.existsSync(config.paths.thumbnails)) fs.mkdirSync(config.paths.thumbnails, { recursive: true });
  
  const uploadWatcher = chokidar.watch(config.paths.uploads, {
    ignored: [
        /(^|[\/\\])\../,
        /.*\.clypse-chunk\.\d+$/,
        /.*\.clypse-temp$/,
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
    .on('unlink', (filePath) => removeFile(path.basename(filePath)))
    .on('error', (error) => logger.error('VIDEO_WATCHER_ERROR', { error: error.message }));
  
  logger.info(`File watchers initialized.`);
};

export const syncOnStartup = async () => {
    logger.info('Performing startup directory sync...');
    try {
        const filesInVideosDir = new Set(
            fs.readdirSync(config.paths.videos)
              .filter(file => !fs.statSync(path.join(config.paths.videos, file)).isDirectory())
        );
        const videosInDb = await videoService.getAllVideos();

        for (const dbVideo of videosInDb) {
            if (!filesInVideosDir.has(dbVideo.file_name)) {
                logger.info(`[SYNC] File from DB not found in directory, removing entry: ${dbVideo.file_name}`);
                await removeFile(dbVideo.file_name);
            }
        }

        const filesInUploadsDir = fs.readdirSync(config.paths.uploads, { withFileTypes: true });
        for (const file of filesInUploadsDir) {
            if (file.isFile()) {
                const filePath = path.join(config.paths.uploads, file.name);
                if (file.name.endsWith('.clypse-temp') || file.name.includes('.clypse-chunk.')) {
                    logger.info(`[SYNC] Cleaning up stale temp file: ${file.name}`);
                    await fs.promises.unlink(filePath).catch(e => logger.error('FAILED_TO_CLEANUP_STALE_TEMP_FILE', { file: file.name, error: e.message }));
                } else {
                    logger.info(`[SYNC] Found unsynced file in uploads dir, adding to queue: ${file.name}`);
                    addToQueue(filePath);
                }
            }
        }

        logger.info('Startup sync complete.');
    } catch (error) {
        logger.error('STARTUP_SYNC_ERROR', { error: error.message });
    }
};