import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

export const streamVideoFile = async (req, res, video) => {
  const videoPath = path.join(config.paths.videos, video.file_name);
  
  try {
    await fsp.access(videoPath, fs.constants.F_OK);
  } catch (e) {
    logger.error('FILE_NOT_FOUND', { path: videoPath });
    throw new ApiError(404, 'Video source file is missing from disk.');
  }

  const stat = await fsp.stat(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }
    
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end, highWaterMark: 1024 * 1024 });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);

    file.on('error', (err) => {
      logger.error('STREAM_ERROR', { error: err.message, path: videoPath });
      res.end();
    });

    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);

    const file = fs.createReadStream(videoPath, { highWaterMark: 1024 * 1024 });
    
    file.on('error', (err) => {
      logger.error('STREAM_ERROR', { error: err.message, path: videoPath });
      res.end();
    });
    
    file.pipe(res);
  }
};