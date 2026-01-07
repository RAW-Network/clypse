import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

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
  const CHUNK_SIZE = 64 * 1024;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 ** 6, fileSize - 1);

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }
    
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end, highWaterMark: CHUNK_SIZE });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
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
      'Content-Type': 'video/mp4',
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