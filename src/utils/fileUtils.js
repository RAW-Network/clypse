import fs from 'fs';

export const moveFileCrossDevice = (source, destination) => {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);

        readStream.on('error', reject);
        writeStream.on('error', reject);

        writeStream.on('finish', () => {
            fs.unlink(source, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        readStream.pipe(writeStream);
    });
};