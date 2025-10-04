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
export const processingFiles = new Set();

const FFMPEG_TIMEOUT = 5 * 60 * 1000;

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

export const processNewFile = async (fileName, titleOverride, originalFileName) => {
  if (processingFiles.has(fileName)) {
    logger.warn('File is already being processed, skipping.', { file: fileName });
    return;
  }
  
  if (!config.allowedVideoExtensions.has(path.extname(fileName).toLowerCase())) {
    throw new ApiError(400, 'Invalid file type.');
  }

  try {
    processingFiles.add(fileName);
    const filePath = path.join(config.paths.videos, fileName);
    
    if (!fs.existsSync(filePath)) {
        throw new ApiError(404, `File not found at path: ${filePath}`);
    }

    const metadata = await getFileMetadata(filePath);
    
    const videoBasename = path.basename(fileName, path.extname(fileName));
    const thumbnailFilename = `${videoBasename}.png`;
    
    await generateThumbnail(filePath, config.paths.thumbnails, thumbnailFilename, metadata.duration);

    const titleBasis = titleOverride || path.basename(originalFileName, path.extname(originalFileName));
    const rawTitle = titleBasis.replace(/_/g, ' ');
    const videoTitle = escapeHtml(rawTitle);

    const videoData = {
      title: videoTitle,
      fileName: fileName,
      originalFileName: originalFileName || fileName,
      thumbnailFilename: thumbnailFilename,
      ...metadata
    };

    const newVideoEntry = await videoService.createVideoEntry(videoData);
    broadcast({ type: 'video:added', payload: newVideoEntry });
    logger.info(`Successfully processed and added video.`, { uuid: newVideoEntry.uuid, title: newVideoEntry.title });
    return newVideoEntry;
  } catch (error) {
    logger.error('FILE_PROCESSING_ERROR', { file: fileName, error: error.message });
    throw error;
  } finally {
    processingFiles.delete(fileName);
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

export const initializeFileWatcher = () => {
  if (!fs.existsSync(config.paths.videos)) fs.mkdirSync(config.paths.videos, { recursive: true });
  if (!fs.existsSync(config.paths.thumbnails)) fs.mkdirSync(config.paths.thumbnails, { recursive: true });
  
  const watcher = chokidar.watch(config.paths.videos, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
  });

  const isUuidFileName = (name) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(name);

  watcher
    .on('add', async (filePath) => {
      const originalFileName = path.basename(filePath);
      
      if (isUuidFileName(originalFileName) || processingFiles.has(originalFileName)) {
        return;
      }
      
      try {
        logger.info('Manual file addition detected. Standardizing and processing.', { file: originalFileName });
        const fileExt = path.extname(originalFileName).toLowerCase();

        if (!config.allowedVideoExtensions.has(fileExt)) {
            logger.warn('Unsupported file type by watcher, skipping.', { file: originalFileName });
            return;
        }

        const newFileName = `${uuidv4()}${fileExt}`;
        const newFilePath = path.join(config.paths.videos, newFileName);
        
        await fs.promises.rename(filePath, newFilePath);
        logger.info('File watcher renamed file.', { from: originalFileName, to: newFileName });
        
        await processNewFile(newFileName, null, originalFileName);

      } catch (error) {
        logger.error('Manual file processing failed.', { file: originalFileName, error: error.message });
      }
    })
    .on('unlink', (filePath) => removeFile(path.basename(filePath)))
    .on('error', (error) => logger.error('WATCHER_ERROR', { error: error.message }));
  
  logger.info(`File watcher initialized.`, { directory: config.paths.videos });
};

export const syncOnStartup = async () => {
    logger.info('Performing startup directory sync...');
    try {
        const filesInDir = new Set(fs.readdirSync(config.paths.videos));
        const videosInDb = await videoService.getAllVideos();
        const dbFileNames = new Set(videosInDb.map(v => v.file_name));
        const isUuidFileName = (name) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(name);

        for (const dbVideo of videosInDb) {
            if (!filesInDir.has(dbVideo.file_name)) {
                logger.info(`File from DB not found in directory, removing entry: ${dbVideo.file_name}`);
                await removeFile(dbVideo.file_name);
            }
        }

        for (const fileName of filesInDir) {
            if (dbFileNames.has(fileName)) continue;

            if (isUuidFileName(fileName)) {
                logger.info(`Found unsynced UUID file: ${fileName}. Processing...`);
                await processNewFile(fileName, null, fileName);
            } else {
                logger.info(`Found unsynced manual file: ${fileName}. Renaming and processing...`);
                const fileExt = path.extname(fileName).toLowerCase();
                const newFileName = `${uuidv4()}${fileExt}`;
                const oldFilePath = path.join(config.paths.videos, fileName);
                const newFilePath = path.join(config.paths.videos, newFileName);
                await fs.promises.rename(oldFilePath, newFilePath);
                await processNewFile(newFileName, null, fileName);
            }
        }
        logger.info('Startup sync complete.');
    } catch (error) {
        logger.error('STARTUP_SYNC_ERROR', { error: error.message });
    }
};