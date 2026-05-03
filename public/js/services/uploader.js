import * as store from '../state/store.js';

const CHUNK_SIZE = 5 * 1024 * 1024;

const uploadChunk = (fileObj, chunkIndex, totalChunks, uploadId, sanitizedFileName, baseTitle, onChunkProgress) => {
  return new Promise((resolve, reject) => {
    const { id, file } = fileObj;
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const xhr = new XMLHttpRequest();
    store.setActiveXHR(id, xhr);

    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Upload-ID', uploadId);
    xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));
    xhr.setRequestHeader('X-Total-Chunks', String(totalChunks));
    xhr.setRequestHeader('X-File-Name', sanitizedFileName);
    xhr.setRequestHeader('X-File-Size', String(file.size));

    if (chunkIndex === totalChunks - 1 && baseTitle) {
      xhr.setRequestHeader('X-File-Title', encodeURIComponent(baseTitle));
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onChunkProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      store.removeActiveXHR(id);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        let errorMsg = `Upload failed for ${file.name}`;
        try {
          errorMsg = JSON.parse(xhr.responseText).message || errorMsg;
        } catch (e) {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      store.removeActiveXHR(id);
      reject(new Error(`Network error during upload of ${file.name}`));
    };

    xhr.onabort = () => {
      store.removeActiveXHR(id);
      reject(new Error('Upload aborted'));
    };

    xhr.send(chunk);
  });
};

export const uploadFile = async (fileObj, baseTitle, onProgress) => {
  const { id, file } = fileObj;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  const uploadId = `${safeName}-${Date.now()}`;
  const sanitizedFileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');

  store.setUploadProgressEntry(id, { loaded: 0, total: file.size });
  let totalUploadedForThisFile = 0;

  for (let i = 0; i < totalChunks; i++) {
    await uploadChunk(fileObj, i, totalChunks, uploadId, sanitizedFileName, baseTitle, (chunkLoaded) => {
      const currentLoaded = totalUploadedForThisFile + chunkLoaded;
      store.setUploadProgressEntry(id, { loaded: currentLoaded, total: file.size });
      onProgress(id, currentLoaded, file.size);
    });
    totalUploadedForThisFile += Math.min(CHUNK_SIZE, file.size - (i * CHUNK_SIZE));
  }

  return file.name;
};

export const abortAllUploads = () => {
  const xhrs = store.getActiveXHRs();
  Object.values(xhrs).forEach(xhr => xhr.abort());
  store.clearActiveXHRs();
};
