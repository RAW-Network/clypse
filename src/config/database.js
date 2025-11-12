import sqlite3 from 'sqlite3';
import fs from 'fs';
import config from './index.js';
import logger from '../utils/logger.js';

const dbPath = config.paths.database;
const dbDir = config.paths.data;

if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info('Data directory created.', { path: dbDir });
  } catch (err) {
     logger.error('FAILED_TO_CREATE_DATA_DIR', { path: dbDir, error: err.message });
     process.exit(1);
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('DATABASE_CONNECTION_ERROR', { path: dbPath, error: err.message });
    process.exit(1);
  }
  logger.info('Database connected successfully.');
});

export const initializeDatabase = () => {
  return new Promise(async (resolve, reject) => {
    const query = `
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL UNIQUE,
        original_file_name TEXT,
        thumbnail TEXT,
        width INTEGER,
        height INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.run(query, (err) => {
      if (err) {
        logger.error('DATABASE_INIT_ERROR', { error: err.message });
        return reject(err);
      }
      logger.info('Database initialized or already exists.');
      resolve();
    });
  });
};

export default db;