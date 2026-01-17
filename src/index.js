import http from 'http';
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { initializeDatabase } from './config/database.js';
import { initWebSocketServer } from './services/websocket.service.js';
import * as startupService from './services/startup.service.js';
import * as fileWatcherService from './services/fileWatcher.service.js';
import * as queueService from './services/queue.service.js';

process.env.TZ = config.timezone;

const startServer = async () => {
  try {
    await startupService.cleanupOldTempFiles();
    setInterval(startupService.cleanupOldTempFiles, 60 * 60 * 1000); 

    await initializeDatabase();

    const server = http.createServer(app);

    initWebSocketServer(server);

    server.listen(config.port, async () => {
      logger.info(`Server is running.`, { url: `http://localhost:${config.port}` });
      
      await startupService.syncOnStartup();
      
      fileWatcherService.initializeFileWatcher();

      queueService.processQueue();
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