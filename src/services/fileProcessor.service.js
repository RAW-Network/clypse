import path from 'path';
import fs from 'fs/promises';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as videoService from './video.service.js';
import * as mediaService from './media.service.js';
import * as storageService from './storage.service.js';
import { broadcast } from './websocket.service.js';
import { escapeHtml } from '../utils/escape.js';
import { moveFileCrossDevice, sanitizeFilename } from '../utils/fileUtils.js';

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

    await mediaService.scanFile(tempFilePath);

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
    const uniqueFileName = await storageService.getUniqueFileName(sanitizedName);
    const finalVideoPath = path.join(config.paths.videos, uniqueFileName);

    await moveFileCrossDevice(tempFilePath, finalVideoPath);

    logger.info('Optimizing video for streaming (faststart)...', { file: uniqueFileName });
    const tempFaststartPath = finalVideoPath + '.faststart.mp4';
    
    try {
        await mediaService.optimizeVideo(finalVideoPath, tempFaststartPath);
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

    const metadata = await mediaService.getFileMetadata(finalVideoPath);

    const videoBasename = path.basename(uniqueFileName, path.extname(uniqueFileName));
    const thumbnailFilename = `${videoBasename}.png`;

    await mediaService.generateThumbnail(finalVideoPath, config.paths.thumbnails, thumbnailFilename, metadata.duration);

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