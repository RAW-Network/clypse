import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import util from 'util';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as videoService from './video.service.js';
import { broadcast } from './websocket.service.js';
import { escapeHtml } from '../utils/escape.js';
import { moveFileCrossDevice, getUniqueFileName, sanitizeFilename } from '../utils/fileUtils.js';

const execFilePromise = util.promisify(execFile);
const FFMPEG_TIMEOUT = 5 * 60 * 1000;

const scanFile = async (filePath) => {
  logger.info(`Scanning file: ${filePath}`);
  await new Promise(resolve => setTimeout(resolve, 100));
  logger.info(`Scan complete for file: ${filePath}`);
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

      const stats = await fs.stat(thumbnailPath);
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

export const processUploadedFile = async (tempFilePath, originalFileName) => {
  try {
    try {
      await fs.access(tempFilePath);
    } catch {
      logger.warn('File not found for processing, it may have been moved or deleted.', { file: tempFilePath });
      return;
    }

    if (!config.allowedVideoExtensions.has(path.extname(originalFileName).toLowerCase())) {
        logger.warn('Invalid file type, deleting.', { file: originalFileName });
        await fs.unlink(tempFilePath);
        return;
    }

    await scanFile(tempFilePath);

    let titleBasis = path.basename(originalFileName, path.extname(originalFileName));
    const metaFilePath = tempFilePath + '.meta';

    try {
      await fs.access(metaFilePath);
      try {
        titleBasis = await fs.readFile(metaFilePath, 'utf-8');
        await fs.unlink(metaFilePath);
        logger.info('Found and used .meta file for title', { file: tempFilePath });
      } catch (err) {
        logger.warn('Failed to read/delete .meta file, falling back to filename', { file: metaFilePath, error: err.message });
      }
    } catch {
    }

    const sanitizedName = sanitizeFilename(originalFileName);
    const uniqueFileName = await getUniqueFileName(sanitizedName);
    const finalVideoPath = path.join(config.paths.videos, uniqueFileName);

    await moveFileCrossDevice(tempFilePath, finalVideoPath);

    logger.info('Optimizing video for streaming (faststart)...', { file: uniqueFileName });
    const tempFaststartPath = finalVideoPath + '.faststart.mp4';
    const faststartArgs = [
        '-i', finalVideoPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        tempFaststartPath
    ];

    try {
        await execFilePromise('ffmpeg', faststartArgs, { timeout: FFMPEG_TIMEOUT });
        await fs.rename(tempFaststartPath, finalVideoPath);
        logger.info('Video optimization (faststart) successful.', { file: uniqueFileName });
    } catch (error) {
        logger.error('FFMPEG_FASTSTART_ERROR', { error: error.message, file: uniqueFileName });
        try {
            await fs.access(tempFaststartPath);
            await fs.unlink(tempFaststartPath);
        } catch {}
        logger.warn('Continuing with unoptimized file.', { file: uniqueFileName });
    }

    const metadata = await getFileMetadata(finalVideoPath);

    const videoBasename = path.basename(uniqueFileName, path.extname(uniqueFileName));
    const thumbnailFilename = `${videoBasename}.png`;

    await generateThumbnail(finalVideoPath, config.paths.thumbnails, thumbnailFilename, metadata.duration);

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
    logger.error('FILE_PROCESSING_ERROR', { file: originalFileName, error: error.message || error });
    try {
      await fs.access(tempFilePath);
      await fs.unlink(tempFilePath).catch(e => logger.error('FAILED_TO_CLEANUP_FAILED_UPLOAD', { file: tempFilePath, error: e.message }));
    } catch {}
  }
};