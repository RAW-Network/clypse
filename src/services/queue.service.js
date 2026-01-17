import logger from '../utils/logger.js';
import * as fileProcessor from './fileProcessor.service.js';
import path from 'path';

const processingQueue = [];
let isProcessing = false;

export const addToQueue = (filePath) => {
    if (filePath.endsWith('.meta')) {
        return;
    }
    if (!processingQueue.some(item => item.filePath === filePath)) {
        const originalFileName = path.basename(filePath);
        processingQueue.push({ filePath, originalFileName });
        logger.info('File added to processing queue.', { file: originalFileName, queueSize: processingQueue.length });
        processQueue();
    }
};

export const processQueue = async () => {
    if (isProcessing || processingQueue.length === 0) {
        return;
    }

    isProcessing = true;
    const { filePath, originalFileName } = processingQueue.shift();

    logger.info(`Processing file from queue: ${originalFileName}`);
    await fileProcessor.processUploadedFile(filePath, originalFileName);

    isProcessing = false;
    setImmediate(processQueue);
};