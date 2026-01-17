import db from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export const getAll = () => {
  return new Promise((resolve, reject) => {
    const query = "SELECT id, uuid, title, thumbnail, created_at, file_name FROM videos ORDER BY created_at DESC";
    db.all(query, [], (err, rows) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      resolve(rows);
    });
  });
};

export const getByUuid = (uuid) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM videos WHERE uuid = ?", [uuid], (err, row) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      if (!row) return reject(new ApiError(404, 'Video not found'));
      resolve(row);
    });
  });
};

export const findByFilename = (filename) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM videos WHERE file_name = ?", [filename], (err, row) => {
      if (err) return reject(new ApiError(500, 'Database query failed'));
      resolve(row);
    });
  });
};

export const create = (params) => {
  return new Promise((resolve, reject) => {
    const query = "INSERT INTO videos (uuid, title, file_name, original_file_name, thumbnail, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    db.run(query, params, function (err) {
      if (err) {
        logger.error('DATABASE_INSERT_ERROR', { error: err.message, query, params });
        return reject(new ApiError(500, 'Failed to create video entry'));
      }
      resolve(this.lastID);
    });
  });
};

export const deleteByFilename = (filename) => {
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