import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';

export const getAllVideos = () => {
  return new Promise((resolve, reject) => {
    const query = "SELECT id, uuid, title, thumbnail, created_at, file_name FROM videos ORDER BY created_at DESC";
    db.all(query, [], (err, rows) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      const videos = rows.map(video => ({
        ...video,
        share_url: `/share/${video.uuid}`,
        streaming_url: `/s/${video.uuid}`
      }));
      resolve(videos);
    });
  });
};

export const getVideoByUuid = (uuid) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM videos WHERE uuid = ?", [uuid], (err, row) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      if (!row) return reject(new ApiError(404, 'Video not found'));
      resolve(row);
    });
  });
};

export const findVideoByFilename = (filename) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM videos WHERE file_name = ?", [filename], (err, row) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      resolve(row);
    });
  });
};

export const createVideoEntry = (videoData) => {
  return new Promise((resolve, reject) => {
    const newUuid = uuidv4();
    const thumbnailPath = `/data/thumbnails/${videoData.thumbnailFilename}`;
    const query = "INSERT INTO videos (uuid, title, file_name, original_file_name, thumbnail, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
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

    db.run(query, params, function (err) {
      if (err) {
          logger.error('DATABASE_INSERT_ERROR', { error: err.message, query, params });
          return reject(new ApiError(500, 'Failed to create video entry'));
      }
      resolve({
        id: this.lastID,
        uuid: newUuid,
        title: videoData.title,
        thumbnail: thumbnailPath,
        created_at: params[7],
        share_url: `/share/${newUuid}`,
        streaming_url: `/s/${newUuid}`
      });
    });
  });
};

export const deleteVideoByFilename = (filename) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT uuid FROM videos WHERE file_name = ?", [filename], (err, row) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      if (!row) return resolve(null);

      const uuid = row.uuid;
      db.run("DELETE FROM videos WHERE file_name = ?", [filename], (err) => {
        if (err) return reject(new ApiError(500, 'Failed to delete video entry'));
        resolve(uuid);
      });
    });
  });
};