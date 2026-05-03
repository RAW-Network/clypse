import * as store from '../state/store.js';
import { showToast } from './toast.js';
import { uploadFile, abortAllUploads } from '../services/uploader.js';
import { TRASH_ICON } from './icons.js';

const renderFileList = () => {
  const fileListContainer = document.getElementById('file-list-container');
  const fileNameSpan = document.getElementById('file-name');
  const files = store.getFilesToUpload();

  fileListContainer.innerHTML = '';

  if (files.length > 0) {
    fileNameSpan.textContent = `${files.length} ${files.length === 1 ? 'file' : 'files'} selected`;
  } else {
    fileNameSpan.textContent = 'No file chosen';
  }

  files.forEach(fileObj => {
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.id = fileObj.id;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'file-list-name';
    nameDiv.textContent = fileObj.file.name;

    const progressContainer = document.createElement('div');
    progressContainer.className = 'file-progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'file-progress-bar';
    progressContainer.appendChild(progressBar);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-list-remove';
    removeBtn.title = 'Remove file';
    removeBtn.innerHTML = TRASH_ICON;
    removeBtn.addEventListener('click', () => {
      store.removeFileFromUpload(fileObj.id);
      renderFileList();
    });

    item.appendChild(nameDiv);
    item.appendChild(progressContainer);
    item.appendChild(removeBtn);
    fileListContainer.appendChild(item);
  });
};

const addFilesToQueue = (newFiles) => {
  const config = store.getConfig();

  for (const file of newFiles) {
    if (store.getFilesToUpload().length >= config.maxUploadCount) {
      showToast(`Cannot add more files Max upload count is ${config.maxUploadCount}`, true);
      break;
    }

    if (file.size > config.maxUploadSize) {
      showToast(`File "${file.name}" is too large Max size is ${config.maxUploadSizeString}`, true);
      continue;
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    store.addFileToUpload({ id: fileId, file });
  }

  renderFileList();
};

const updateOverallProgress = (uploadButton) => {
  const progress = store.getUploadProgress();
  let totalLoaded = 0;
  let totalSize = 0;

  for (const id in progress) {
    totalLoaded += progress[id].loaded;
    totalSize += progress[id].total;
  }

  if (totalSize === 0) {
    uploadButton.textContent = 'Uploading 0%';
    return;
  }

  const totalProgress = Math.min(Math.floor((totalLoaded / totalSize) * 100), 100);
  uploadButton.textContent = `Uploading ${totalProgress}%`;
};

export const setupUploadForm = () => {
  const uploadFormContainer = document.getElementById('upload-form-container');
  const uploadForm = document.getElementById('upload-form');
  const fileInput = document.getElementById('videoFile');
  const titleInput = document.getElementById('title');
  const uploadButton = document.getElementById('upload-button');
  const cancelButton = document.getElementById('cancel-button');

  const overlayContent = uploadFormContainer.querySelector('.drag-overlay-content');
  if (!overlayContent) return;
  const dragOverlayDetails = overlayContent.querySelector('.drag-overlay-details');
  if (!dragOverlayDetails) return;

  fileInput.addEventListener('change', () => {
    addFilesToQueue(fileInput.files);
    fileInput.value = '';
  });

  cancelButton.addEventListener('click', () => {
    abortAllUploads();
    uploadButton.disabled = false;
    uploadButton.textContent = 'Upload';
    cancelButton.style.display = 'none';
    uploadForm.classList.remove('is-uploading');
    showToast('Upload cancelled', true);
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const files = store.getFilesToUpload();
    if (files.length === 0) {
      showToast('Please add files to upload first', true);
      return;
    }

    const baseTitle = titleInput.value;

    uploadButton.disabled = true;
    cancelButton.style.display = 'inline-flex';
    uploadForm.classList.add('is-uploading');
    store.clearUploadProgress();

    files.forEach(f => {
      store.setUploadProgressEntry(f.id, { loaded: 0, total: f.file.size });
    });
    updateOverallProgress(uploadButton);

    const uploadPromises = files.map(fileObj =>
      uploadFile(fileObj, baseTitle, (fileId, loaded, total) => {
        const fileItemElem = document.getElementById(fileId);
        if (fileItemElem) {
          const progressBar = fileItemElem.querySelector('.file-progress-bar');
          const percent = (loaded / total) * 100;
          progressBar.style.width = `${percent}%`;
        }
        updateOverallProgress(uploadButton);
      })
        .then(fileName => {
          const fileItemElem = document.getElementById(fileObj.id);
          if (fileItemElem) {
            const progressBar = fileItemElem.querySelector('.file-progress-bar');
            progressBar.style.width = '100%';
          }
          return fileName;
        })
        .catch(err => ({
          error: true,
          message: err.message,
          fileName: fileObj.file.name
        }))
    );

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => !r.error);
      const failedUploads = results.filter(r => r.error);

      if (successfulUploads.length > 0) {
        showToast(`Successfully uploaded ${successfulUploads.length} ${successfulUploads.length === 1 ? 'file' : 'files'}`, false);
      }

      if (failedUploads.length > 0) {
        failedUploads.forEach(fail => {
          showToast(`Failed: ${fail.fileName} - ${fail.message.replace(`Upload failed for ${fail.fileName}`, '').trim()}`, true);
        });
      }
    } catch (error) {
      if (!error.message.includes('aborted')) {
        showToast(`An unexpected error occurred: ${error.message}`, true);
      }
      console.error('Upload error', error);
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = 'Upload';
      cancelButton.style.display = 'none';
      uploadForm.classList.remove('is-uploading');
      uploadForm.reset();
      store.clearFilesToUpload();
      store.clearActiveXHRs();
      store.clearUploadProgress();
      renderFileList();
    }
  });

  uploadFormContainer.addEventListener('dragenter', (e) => {
    e.preventDefault();
    const config = store.getConfig();
    let detailsText = 'Drop files here';
    if (isFinite(config.maxUploadCount)) {
      detailsText += ` Up to ${config.maxUploadCount} files`;
    }
    if (isFinite(config.maxUploadSize) && config.maxUploadSizeString !== 'Unlimited') {
      detailsText += ` Max ${config.maxUploadSizeString} per file`;
    }
    dragOverlayDetails.textContent = detailsText.endsWith('.') ? detailsText.slice(0, -1) : detailsText;
    uploadFormContainer.classList.add('drag-over');
  });

  uploadFormContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadFormContainer.classList.add('drag-over');
  });

  uploadFormContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!uploadFormContainer.contains(e.relatedTarget)) {
      uploadFormContainer.classList.remove('drag-over');
    }
  });

  uploadFormContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadFormContainer.classList.remove('drag-over');
    addFilesToQueue(e.dataTransfer.files);
  });
};
