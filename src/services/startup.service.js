import fs from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as videoService from './video.service.js';
import { addToQueue } from './queue.service.js';

export const cleanupOldTempFiles = async () => {
    const uploadDir = config.paths.uploads;
    
    try {
        await fs.access(uploadDir);
    } catch {
        return;
    }

    const oneHour = 60 * 60 * 1000;

    try {
        const files = await fs.readdir(uploadDir, { withFileTypes: true });

        for (const file of files) {
            if (file.isFile() && (file.name.endsWith('.clypse-temp') || file.name.includes('.clypse-chunk.'))) {
                const filePath = path.join(uploadDir, file.name);
                try {
                    const stats = await fs.stat(filePath);
                    if (Date.now() - stats.mtime.getTime() > oneHour) {
                        await fs.rm(filePath, { recursive: false, force: true });
                        logger.info('Cleaned up old temp file.', { path: filePath });
                    }
                } catch (statError) {
                    logger.error('TEMP_CLEANUP_STAT_ERROR', { file: filePath, error: statError.message });
                }
            }
        }
    } catch (readError) {
        logger.error('TEMP_CLEANUP_READ_ERROR', { directory: uploadDir, error: readError.message });
    }
};

export const syncOnStartup = async () => {
    logger.info('Performing startup directory sync...');
    try {
        await fs.mkdir(config.paths.uploads, { recursive: true });
        await fs.mkdir(config.paths.videos, { recursive: true });
        await fs.mkdir(config.paths.thumbnails, { recursive: true });

        const filesInVideosDirArr = await fs.readdir(config.paths.videos);
        const filesInVideosDir = new Set(filesInVideosDirArr);
        
        const videosInDb = await videoService.getAllVideos();

        for (const dbVideo of videosInDb) {
            if (!filesInVideosDir.has(dbVideo.file_name)) {
                logger.info(`[SYNC] File from DB not found in directory, removing entry: ${dbVideo.file_name}`);
                await videoService.deleteVideoData(dbVideo.file_name, false);
            }
        }

        const filesInUploadsDir = await fs.readdir(config.paths.uploads, { withFileTypes: true });
        for (const file of filesInUploadsDir) {
            if (file.isFile()) {
                const filePath = path.join(config.paths.uploads, file.name);
                if (file.name.endsWith('.clypse-temp') || file.name.includes('.clypse-chunk.') || file.name.endsWith('.meta')) {
                    logger.info(`[SYNC] Cleaning up stale temp/meta file: ${file.name}`);
                    await fs.unlink(filePath).catch(e => logger.error('FAILED_TO_CLEANUP_STALE_TEMP_FILE', { file: file.name, error: e.message }));
                } else {
                    logger.info(`[SYNC] Found unsynced file in uploads dir, adding to queue: ${file.name}`);
                    addToQueue(filePath);
                }
            }
        }

        logger.info('Startup sync complete.');
    } catch (error) {
        logger.error('STARTUP_SYNC_ERROR', { error: error.message });
    }
};