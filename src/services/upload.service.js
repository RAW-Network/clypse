import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import { moveFileCrossDevice, sanitizeFilename } from '../utils/fileUtils.js';

export const handleUploadChunk = async (headers, body) => {
  const {
    'x-upload-id': uploadId,
    'x-chunk-index': chunkIndex,
    'x-total-chunks': totalChunks,
    'x-file-name': rawFileName,
    'x-file-size': fileSize,
    'x-file-title': rawFileTitle,
  } = headers;

  if (!uploadId || !chunkIndex || !totalChunks || !rawFileName || !fileSize) {
    throw new ApiError(400, 'Missing upload headers');
  }

  const originalFileName = sanitizeFilename(path.basename(rawFileName));
  const fileExt = path.extname(originalFileName).toLowerCase();

  if (!config.allowedVideoExtensions.has(fileExt)) {
    throw new ApiError(400, `File type not allowed. Received: ${fileExt}`);
  }

  if (parseInt(fileSize, 10) > config.maxUploadSize) {
    throw new ApiError(413, `File size exceeds the limit of ${config.maxUploadSizeString}.`);
  }

  const chunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${chunkIndex}`);

  try {
    await fs.promises.writeFile(chunkPath, body);

    const isLastChunk = parseInt(chunkIndex, 10) === parseInt(totalChunks, 10) - 1;

    if (isLastChunk) {
      const tempFilePath = path.join(config.paths.uploads, `${uploadId}.clypse-temp`);
      const writeStream = fs.createWriteStream(tempFilePath);
      const chunkPaths = [];

      for (let i = 0; i < parseInt(totalChunks, 10); i++) {
        const currentChunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${i}`);
        
        try {
            await fs.promises.access(currentChunkPath);
        } catch {
            throw new ApiError(500, `Missing chunk ${i} for upload ${uploadId}`);
        }
        
        const chunkBuffer = await fs.promises.readFile(currentChunkPath);
        writeStream.write(chunkBuffer);
        chunkPaths.push(currentChunkPath);
      }
      writeStream.end();

      return new Promise((resolve, reject) => {
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
            resolve({
              status: 'success',
              message: `${title} has been uploaded and is queued for processing!`,
            });

          } catch (error) {
            reject(error);
          }
        });

        writeStream.on('error', async (err) => {
          await fs.promises.unlink(tempFilePath).catch(() => {});
          for (const p of chunkPaths) {
            await fs.promises.unlink(p).catch(() => {});
          }
          reject(new ApiError(500, 'Failed to assemble file'));
        });
      });
    } else {
      return { status: 'chunk_received' };
    }
  } catch (error) {
    throw error;
  }
};

export const cancelUpload = async (uploadId) => {
  if (!uploadId) {
    throw new ApiError(400, 'uploadId is required');
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
    return { status: 'success', message: 'Upload cancelled' };
  } catch (error) {
    logger.error('Failed to clean up cancelled upload', { uploadId, error: error.message });
    throw new ApiError(500, 'Could not clean up temp files');
  }
};