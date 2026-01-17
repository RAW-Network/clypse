import fs from 'fs';

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