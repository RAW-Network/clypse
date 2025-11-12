import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import * as videoService from '../services/video.service.js';

export const moveFileCrossDevice = (source, destination) => {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);

        readStream.on('error', (err) => reject(`Read stream error: ${err.message}`));
        writeStream.on('error', (err) => reject(`Write stream error: ${err.message}`));

        writeStream.on('finish', () => {
            fs.unlink(source, (err) => {
                if (err) return reject(`Unlink error: ${err.message}`);
                resolve();
            });
        });

        readStream.pipe(writeStream);
    });
};

export const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';
  return filename
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');
};

export const getUniqueFileName = async (fileName) => {
    let finalName = fileName;
    let counter = 1;
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    const fileExists = async (name) => {
        try {
            await fsp.access(path.join(config.paths.videos, name));
            return true;
        } catch {
            return false;
        }
    };

    let existsOnDisk = await fileExists(finalName);
    let existsInDb = await videoService.findVideoByFilename(finalName);

    while (existsOnDisk || existsInDb) {
        finalName = `${base} (${counter++})${ext}`;
        existsOnDisk = await fileExists(finalName);
        existsInDb = await videoService.findVideoByFilename(finalName);
    }
    return finalName;
};