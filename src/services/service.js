import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import * as videoRepository from '../repositories/video.repository.js';

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
    let existsInDb = await videoRepository.findByFilename(finalName);

    while (existsOnDisk || existsInDb) {
        finalName = `${base} (${counter++})${ext}`;
        existsOnDisk = await fileExists(finalName);
        existsInDb = await videoRepository.findByFilename(finalName);
    }
    return finalName;
};