import { v4 as uuidv4 } from 'uuid';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { broadcast } from './websocket.service.js';
import * as videoRepository from '../repositories/video.repository.js';

export const getAllVideos = async () => {
  const rows = await videoRepository.getAll();
  return rows.map(video => ({
    ...video,
    share_url: `/share/${video.uuid}`,
    streaming_url: `/s/${video.uuid}`
  }));
};

export const getVideoByUuid = async (uuid) => {
  return await videoRepository.getByUuid(uuid);
};

export const findVideoByFilename = async (filename) => {
  return await videoRepository.findByFilename(filename);
};

export const createVideoEntry = async (videoData) => {
  const newUuid = uuidv4();
  const thumbnailPath = `/videos/thumbnails/${videoData.thumbnailFilename}`;
  
  const params = [
    newUuid,
    videoData.title,
    videoData.fileName,
    videoData.originalFileName,
    thumbnailPath,
    videoData.width,
    videoData.height,
    new Date().toISOString()
  ];

  const lastID = await videoRepository.create(params);

  return {
    id: lastID,
    uuid: newUuid,
    title: videoData.title,
    thumbnail: thumbnailPath,
    file_name: videoData.fileName,
    created_at: params[7],
    share_url: `/share/${newUuid}`,
    streaming_url: `/s/${newUuid}`
  };
};

export const deleteVideoData = async (fileName, broadcastUpdate = true) => {
  logger.info(`File removal triggered.`, { file: fileName });
  try {
    const removedUuid = await videoRepository.deleteByFilename(fileName);
    if (removedUuid) {
      const videoBasename = path.basename(fileName, path.extname(fileName));
      const thumbnailPath = path.join(config.paths.thumbnails, `${videoBasename}.png`);
      try {
        await fsp.access(thumbnailPath);
        await fsp.unlink(thumbnailPath);
      } catch {}

      if (broadcastUpdate) {
        broadcast({ type: 'video:deleted', payload: { uuid: removedUuid } });
      }
      logger.info(`Successfully removed video entry and thumbnail.`, { uuid: removedUuid });
    }
  } catch (error) {
    logger.error('FILE_REMOVAL_ERROR', { file: fileName, error: error.message });
  }
};