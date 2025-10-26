import http from 'http';
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { initializeDatabase } from './config/database.js';
import { initWebSocketServer } from './services/websocket.service.js';
import { initializeFileWatcher, syncOnStartup, processQueue } from './services/update.service.js';
import fs from 'fs';
import path from 'path';

const cleanupOldTempFiles = () => {
    const uploadDir = config.paths.uploads;
    if (!fs.existsSync(uploadDir)) return;

    const oneHour = 60 * 60 * 1000;

    fs.readdir(uploadDir, { withFileTypes: true }, (err, files) => {
        if (err) {
            logger.error('TEMP_CLEANUP_READ_ERROR', { directory: uploadDir, error: err.message });
            return;
        }

        files.forEach(file => {
            if (file.isFile() && (file.name.endsWith('.clypse-temp') || file.name.includes('.clypse-chunk.'))) {
                const filePath = path.join(uploadDir, file.name);

                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        logger.error('TEMP_CLEANUP_STAT_ERROR', { file: filePath, error: err.message });
                        return;
                    }
                    if (Date.now() - stats.mtime.getTime() > oneHour) {
                        fs.rm(filePath, { recursive: false, force: true }, (err) => {
                            if (err) {
                                logger.error('TEMP_CLEANUP_DELETE_ERROR', { file: filePath, error: err.message });
                            } else {
                                logger.info('Cleaned up old temp file.', { path: filePath });
                            }
                        });
                    }
                });
            }
        });
    });
};

process.env.TZ = config.timezone;

const startServer = async () => {
  try {
    cleanupOldTempFiles();
    setInterval(cleanupOldTempFiles, 60 * 60 * 1000); 

    await initializeDatabase();

    const server = http.createServer(app);

    initWebSocketServer(server);

    server.listen(config.port, async () => {
      logger.info(`Server is running.`, { url: `http://localhost:${config.port}` });
      
      await syncOnStartup();
      
      initializeFileWatcher();

      processQueue();
    });

  } catch (error) {
    logger.error('SERVER_STARTUP_FAILED', { error: error.message });
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED_REJECTION', { reason: reason.message || 'No reason provided' });
});

process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT_EXCEPTION', { error: error.message, stack: error.stack });
  process.exit(1);
});