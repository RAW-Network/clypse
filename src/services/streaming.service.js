import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
};

export const streamVideoFile = async (req, res, video) => {
  const videoPath = path.join(config.paths.videos, video.file_name);

  try {
    await fsp.access(videoPath, fs.constants.R_OK);
  } catch (e) {
    throw new ApiError(404, 'Video source file is not ready.');
  }

  const stat = await fsp.stat(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(video.file_name).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'video/mp4';
  const CHUNK_SIZE = 64 * 1024;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);

    if (isNaN(start) || start < 0 || start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : undefined;
    const end = requestedEnd !== undefined && !isNaN(requestedEnd)
      ? Math.min(requestedEnd, fileSize - 1)
      : Math.min(start + 10 ** 6, fileSize - 1);

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end, highWaterMark: CHUNK_SIZE });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${video.file_name}"`,
    };
    res.writeHead(206, head);

    file.on('error', (err) => {
      logger.error('STREAM_ERROR', { error: err.message, path: videoPath });
      if (!res.headersSent) res.end();
    });

    res.on('close', () => {
      file.destroy();
    });

    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${video.file_name}"`,
    };
    res.writeHead(200, head);

    const file = fs.createReadStream(videoPath, { highWaterMark: CHUNK_SIZE });

    file.on('error', (err) => {
      logger.error('STREAM_ERROR', { error: err.message, path: videoPath });
      if (!res.headersSent) res.end();
    });

    res.on('close', () => {
      file.destroy();
    });

    file.pipe(res);
  }
};