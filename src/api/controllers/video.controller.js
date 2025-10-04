import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';
import * as videoService from '../../services/video.service.js';
import { streamVideoFile } from '../../services/streaming.service.js';
import { processNewFile } from '../../services/update.service.js';
import ApiError from '../../utils/ApiError.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { escapeHtml } from '../../utils/escape.js';
import { v4 as uuidv4 } from 'uuid';

const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
};

export const getVideos = async (req, res, next) => {
  try {
    const videos = await videoService.getAllVideos();
    res.status(200).json({
      status: 'success',
      data: { videos },
    });
  } catch (error) {
    next(error);
  }
};

export const streamVideo = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const video = await videoService.getVideoByUuid(uuid);
    streamVideoFile(req, res, video);
  } catch (error) {
    next(error);
  }
};

export const getSharePage = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const video = await videoService.getVideoByUuid(uuid);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const videoUrl = `${baseUrl}/s/${video.uuid}`;
    const thumbnailUrl = `${baseUrl}${video.thumbnail}`;
    const shareUrl = `${baseUrl}/share/${video.uuid}`;
    
    const safeTitle = escapeHtml(video.title);
    const safeVideoUrl = escapeHtml(videoUrl);
    const safeThumbnailUrl = escapeHtml(thumbnailUrl);
    const safeShareUrl = escapeHtml(shareUrl);
    const safeWidth = escapeHtml(video.width || 1280);
    const safeHeight = escapeHtml(video.height || 720);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${safeTitle}</title>
          <meta name="twitter:card" content="player">
          <meta name="twitter:title" content="${safeTitle}">
          <meta name="twitter:player" content="${safeVideoUrl}">
          <meta name="twitter:player:width" content="${safeWidth}">
          <meta name="twitter:player:height" content="${safeHeight}">
          <meta name="twitter:image" content="${safeThumbnailUrl}">
          <meta property="og:type" content="video.other">
          <meta property="og:title" content="${safeTitle}">
          <meta property="og:url" content="${safeShareUrl}">
          <meta property="og:image" content="${safeThumbnailUrl}">
          <meta property="og:video" content="${safeVideoUrl}">
          <meta property="og:video:secure_url" content="${safeVideoUrl}">
          <meta property="og:video:type" content="video/mp4">
          <meta property="og:video:width" content="${safeWidth}">
          <meta property="og:video:height" content="${safeHeight}">
          <style>
              html, body { background-color: #000; margin: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
              video { width: 100%; height: 100%; object-fit: contain; }
          </style>
      </head>
      <body>
          <video controls autoplay playsinline src="${safeVideoUrl}"></video>
      </body>
      </html>`;
    res.send(html);
  } catch (error) {
    next(error);
  }
};

export const uploadVideoChunk = async (req, res, next) => {
  const {
    'x-upload-id': uploadId,
    'x-chunk-index': chunkIndex,
    'x-total-chunks': totalChunks,
    'x-file-name': rawFileName,
    'x-file-size': fileSize,
    'x-file-title': rawFileTitle,
  } = req.headers;

  if (!uploadId || !chunkIndex || !totalChunks || !rawFileName || !fileSize) {
    return next(new ApiError(400, 'Missing upload headers'));
  }
  
  const originalFileName = sanitizeFilename(path.basename(rawFileName));
  const fileExt = path.extname(originalFileName).toLowerCase();
  
  if (!config.allowedVideoExtensions.has(fileExt)) {
    return next(new ApiError(400, `File type not allowed. Received: ${fileExt}`));
  }

  if (parseInt(fileSize, 10) > config.maxUploadSize) {
    return next(new ApiError(413, `File size exceeds the limit of ${config.maxUploadSizeString}`));
  }

  const tmpDir = path.join(config.paths.data, 'tmp', uploadId);
  fs.mkdirSync(tmpDir, { recursive: true });
  const chunkPath = path.join(tmpDir, chunkIndex);

  try {
    await fs.promises.writeFile(chunkPath, req.body);
    
    const isLastChunk = parseInt(chunkIndex, 10) === parseInt(totalChunks, 10) - 1;

    if (isLastChunk) {
      const tempFileName = `__temp_${uuidv4()}`;
      const tempFilePath = path.join(tmpDir, tempFileName);
      const writeStream = fs.createWriteStream(tempFilePath);
      
      for (let i = 0; i < parseInt(totalChunks, 10); i++) {
        const currentChunkPath = path.join(tmpDir, i.toString());
        if (!fs.existsSync(currentChunkPath)) {
          throw new ApiError(500, `Missing chunk ${i} for upload ${uploadId}`);
        }
        const chunkBuffer = await fs.promises.readFile(currentChunkPath);
        writeStream.write(chunkBuffer);
      }
      writeStream.end();

      writeStream.on('finish', async () => {
        try {
          const finalFileName = `${uuidv4()}${fileExt}`;
          const finalFilePath = path.join(config.paths.videos, finalFileName);

          await fs.promises.rename(tempFilePath, finalFilePath);
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
          
          const originalBasename = path.basename(originalFileName, fileExt);
          const title = rawFileTitle ? decodeURIComponent(rawFileTitle) : originalBasename.replace(/_/g, ' ');
          
          const newVideo = await processNewFile(finalFileName, title, originalFileName);
          
          res.status(201).json({
            status: 'success',
            message: `"${newVideo.title}" has been uploaded!`,
            data: newVideo,
          });
        } catch (error) {
          next(error);
        }
      });

      writeStream.on('error', (err) => {
        fs.promises.rm(tmpDir, { recursive: true, force: true });
        next(new ApiError(500, 'Failed to assemble file'));
      });

    } else {
      res.status(200).send('Chunk received');
    }
  } catch (error) {
    next(error);
  }
};

export const cancelUpload = async (req, res, next) => {
  const { uploadId } = req.body;
  if (!uploadId) {
    return next(new ApiError(400, 'uploadId is required'));
  }
  
  const tmpDir = path.join(config.paths.data, 'tmp', uploadId);

  try {
    if (fs.existsSync(tmpDir)) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
      logger.info('Cancelled upload and cleaned up temp files', { uploadId });
    }
    res.status(200).json({ status: 'success', message: 'Upload cancelled' });
  } catch (error) {
    logger.error('Failed to clean up cancelled upload', { uploadId, error: error.message });
    next(new ApiError(500, 'Could not clean up temp files'));
  }
};