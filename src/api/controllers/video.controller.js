import * as videoService from '../../services/video.service.js';
import { streamVideoFile } from '../../services/streaming.service.js';
import * as uploadService from '../../services/upload.service.js';
import * as shareService from '../../services/share.service.js';
import config from '../../config/index.js';

const videoCache = new Map();

setInterval(() => videoCache.clear(), 60 * 60 * 1000);

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
    let video;

    if (videoCache.has(uuid)) {
      video = videoCache.get(uuid);
    } else {
      video = await videoService.getVideoByUuid(uuid);
      videoCache.set(uuid, video);
    }

    await streamVideoFile(req, res, video);
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
    
    const html = shareService.getSharePageHtml(video, baseUrl);
    res.send(html);
  } catch (error) {
    next(error);
  }
};

export const uploadVideoChunk = async (req, res, next) => {
  try {
    const result = await uploadService.handleUploadChunk(req.headers, req.body);

    if (result.status === 'chunk_received') {
      res.status(200).send('Chunk received');
    } else if (result.status === 'success') {
      res.status(201).json(result);
    }
  } catch (error) {
    next(error);
  }
};

export const cancelUpload = async (req, res, next) => {
  try {
    const { uploadId } = req.body;
    const result = await uploadService.cancelUpload(uploadId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};