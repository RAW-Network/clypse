let allVideos = [];
let appConfig = {};
let filesToUpload = [];
let activeUploadXHRs = {};
let uploadProgress = {};

export const getVideos = () => allVideos;

export const setVideos = (videos) => {
  allVideos = videos;
};

export const addVideo = (video) => {
  if (!allVideos.some(v => v.uuid === video.uuid)) {
    allVideos.unshift(video);
    return true;
  }
  return false;
};

export const removeVideo = (uuid) => {
  const index = allVideos.findIndex(v => v.uuid === uuid);
  if (index > -1) {
    const removed = allVideos[index];
    allVideos.splice(index, 1);
    return removed;
  }
  return null;
};

export const clearVideos = () => {
  allVideos = [];
};

export const getConfig = () => appConfig;

export const setConfig = (config) => {
  appConfig = config;
};

export const getFilesToUpload = () => filesToUpload;

export const addFileToUpload = (fileObj) => {
  filesToUpload.push(fileObj);
};

export const removeFileFromUpload = (fileId) => {
  filesToUpload = filesToUpload.filter(f => f.id !== fileId);
};

export const clearFilesToUpload = () => {
  filesToUpload = [];
};

export const getActiveXHRs = () => activeUploadXHRs;

export const setActiveXHR = (id, xhr) => {
  activeUploadXHRs[id] = xhr;
};

export const removeActiveXHR = (id) => {
  delete activeUploadXHRs[id];
};

export const clearActiveXHRs = () => {
  activeUploadXHRs = {};
};

export const getUploadProgress = () => uploadProgress;

export const setUploadProgressEntry = (id, data) => {
  uploadProgress[id] = data;
};

export const clearUploadProgress = () => {
  uploadProgress = {};
};
