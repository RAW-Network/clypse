import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';
import * as videoService from '../../services/video.service.js';
import { streamVideoFile } from '../../services/streaming.service.js';
import ApiError from '../../utils/ApiError.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { escapeHtml } from '../../utils/escape.js';
import { moveFileCrossDevice } from '../../utils/fileUtils.js';

const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
};

export const getAppConfig = (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      maxUploadCount: config.maxUploadCount,
      maxUploadSize: config.maxUploadSize,
      maxUploadSizeString: config.maxUploadSizeString,
    }
  });
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
    return next(new ApiError(413, `File size exceeds the limit of ${config.maxUploadSizeString}.`));
  }

  const chunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${chunkIndex}`);

  try {
    await fs.promises.writeFile(chunkPath, req.body);
    
    const isLastChunk = parseInt(chunkIndex, 10) === parseInt(totalChunks, 10) - 1;

    if (isLastChunk) {
      const tempFilePath = path.join(config.paths.uploads, `${uploadId}.clypse-temp`);
      const writeStream = fs.createWriteStream(tempFilePath);
      const chunkPaths = [];
      
      for (let i = 0; i < parseInt(totalChunks, 10); i++) {
        const currentChunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${i}`);
        if (!fs.existsSync(currentChunkPath)) {
          throw new ApiError(500, `Missing chunk ${i} for upload ${uploadId}`);
        }
        const chunkBuffer = await fs.promises.readFile(currentChunkPath);
        writeStream.write(chunkBuffer);
        chunkPaths.push(currentChunkPath);
      }
      writeStream.end();

      writeStream.on('finish', async () => {
        try {
          const finalUploadPath = path.join(config.paths.uploads, originalFileName);

          await moveFileCrossDevice(tempFilePath, finalUploadPath);

          if (rawFileTitle) {
            try {
              const title = decodeURIComponent(rawFileTitle);
              const metaFilePath = finalUploadPath + '.meta';
              await fs.promises.writeFile(metaFilePath, title);
            } catch (e) {
              logger.warn('Failed to write .meta file', { file: finalUploadPath, error: e.message });
            }
          }
          
          for (const p of chunkPaths) {
            await fs.promises.unlink(p).catch(err => {
                logger.warn('Failed to cleanup chunk file', { file: p, error: err.message });
            });
          }
          
          const title = rawFileTitle ? decodeURIComponent(rawFileTitle) : path.basename(originalFileName, fileExt).replace(/_/g, ' ');
          
          res.status(201).json({
            status: 'success',
            message: `"${title}" has been uploaded and is queued for processing!`,
          });
        } catch (error) {
          next(error);
        }
      });

      writeStream.on('error', async (err) => {
        await fs.promises.unlink(tempFilePath).catch(() => {});
        for (const p of chunkPaths) {
          await fs.promises.unlink(p).catch(() => {});
        }
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
  
  const uploadDir = config.paths.uploads;

  try {
    const files = await fs.promises.readdir(uploadDir);
    const uploadFiles = files.filter(f => f.startsWith(uploadId + '.clypse-'));
    
    let cleaned = false;
    for (const file of uploadFiles) {
      const filePath = path.join(uploadDir, file);
      await fs.promises.unlink(filePath);
      cleaned = true;
    }

    if (cleaned) {
      logger.info('Cancelled upload and cleaned up temp files', { uploadId });
    }
    res.status(200).json({ status: 'success', message: 'Upload cancelled' });
  } catch (error) {
    logger.error('Failed to clean up cancelled upload', { uploadId, error: error.message });
    next(new ApiError(500, 'Could not clean up temp files'));
  }
};