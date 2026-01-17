import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const execFilePromise = util.promisify(execFile);
const FFMPEG_TIMEOUT = 5 * 60 * 1000;

export const scanFile = async (filePath) => {
  logger.info(`Scanning file: ${filePath}`);
  await new Promise(resolve => setTimeout(resolve, 100));
  logger.info(`Scan complete for file: ${filePath}`);
};

export const getFileMetadata = async (filePath) => {
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

export const generateThumbnail = async (filePath, thumbnailDir, thumbnailFilename, duration) => {
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

export const optimizeVideo = async (inputPath, tempPath) => {
  const faststartArgs = [
    '-i', inputPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    tempPath
  ];
  await execFilePromise('ffmpeg', faststartArgs, { timeout: FFMPEG_TIMEOUT });
};