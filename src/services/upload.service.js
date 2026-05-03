import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import { moveFileCrossDevice, sanitizeFilename } from '../utils/fileUtils.js';

const VALID_UPLOAD_ID = /^[a-zA-Z0-9_.\-]+$/;

const validateUploadHeaders = (headers) => {
  const uploadId = headers['x-upload-id'];
  const chunkIndex = headers['x-chunk-index'];
  const totalChunks = headers['x-total-chunks'];
  const rawFileName = headers['x-file-name'];
  const fileSize = headers['x-file-size'];
  const rawFileTitle = headers['x-file-title'];

  if (!uploadId || !chunkIndex || !totalChunks || !rawFileName || !fileSize) {
    throw new ApiError(400, 'Missing upload headers');
  }

  if (!VALID_UPLOAD_ID.test(uploadId)) {
    throw new ApiError(400, 'Invalid upload ID format');
  }

  const chunkIdx = parseInt(chunkIndex, 10);
  const totalChk = parseInt(totalChunks, 10);
  const size = parseInt(fileSize, 10);

  if (isNaN(chunkIdx) || chunkIdx < 0) {
    throw new ApiError(400, 'Invalid chunk index');
  }

  if (isNaN(totalChk) || totalChk <= 0) {
    throw new ApiError(400, 'Invalid total chunks');
  }

  if (chunkIdx >= totalChk) {
    throw new ApiError(400, 'Chunk index exceeds total chunks');
  }

  if (isNaN(size) || size <= 0) {
    throw new ApiError(400, 'Invalid file size');
  }

  return { uploadId, chunkIdx, totalChk, rawFileName, size, rawFileTitle };
};

export const handleUploadChunk = async (headers, body) => {
  const { uploadId, chunkIdx, totalChk, rawFileName, size, rawFileTitle } = validateUploadHeaders(headers);

  const originalFileName = sanitizeFilename(path.basename(rawFileName));
  const fileExt = path.extname(originalFileName).toLowerCase();

  if (!config.allowedVideoExtensions.has(fileExt)) {
    throw new ApiError(400, `File type not allowed. Received: ${fileExt}`);
  }

  if (size > config.maxUploadSize) {
    throw new ApiError(413, `File size exceeds the limit of ${config.maxUploadSizeString}.`);
  }

  const chunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${chunkIdx}`);

  try {
    await fs.promises.writeFile(chunkPath, body);

    const isLastChunk = chunkIdx === totalChk - 1;

    if (isLastChunk) {
      const tempFilePath = path.join(config.paths.uploads, `${uploadId}.clypse-temp`);
      const writeStream = fs.createWriteStream(tempFilePath);
      const chunkPaths = [];

      for (let i = 0; i < totalChk; i++) {
        const currentChunkPath = path.join(config.paths.uploads, `${uploadId}.clypse-chunk.${i}`);

        try {
          await fs.promises.access(currentChunkPath);
        } catch {
          throw new ApiError(500, `Missing chunk ${i} for upload ${uploadId}`);
        }

        chunkPaths.push(currentChunkPath);
      }

      return new Promise((resolve, reject) => {
        let pipeIndex = 0;

        const pipeNext = () => {
          if (pipeIndex >= chunkPaths.length) {
            writeStream.end();
            return;
          }
          const readStream = fs.createReadStream(chunkPaths[pipeIndex]);
          pipeIndex++;
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', pipeNext);
          readStream.on('error', (err) => {
            writeStream.destroy();
            reject(new ApiError(500, 'Failed to read chunk during assembly'));
          });
        };

        pipeNext();

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

  if (!VALID_UPLOAD_ID.test(uploadId)) {
    throw new ApiError(400, 'Invalid upload ID format');
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