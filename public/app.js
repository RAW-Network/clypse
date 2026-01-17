document.addEventListener("DOMContentLoaded", async () => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  window.scrollTo(0, 0);

  const mainContent = document.getElementById("main-content");
  const yearSpan = document.getElementById("year");
  const modal = document.getElementById("video-modal");
  const videoPlayer = document.getElementById("video-player");
  const logoLink = document.getElementById("logo-link");
  const homeLink = document.getElementById("home-link");
  let allVideos = [];
  let appConfig = {};
  let filesToUpload = [];
  let activeUploadXHRs = {};
  let uploadProgress = {};

  const fetchAppConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error('Failed to load app configuration');
      }
      const data = await res.json();
      appConfig = data.data;

      if (appConfig.maxUploadCount === null || typeof appConfig.maxUploadCount === 'undefined') {
        appConfig.maxUploadCount = Infinity;
      }
      if (appConfig.maxUploadSize === null || typeof appConfig.maxUploadSize === 'undefined') {
        appConfig.maxUploadSize = Infinity;
        appConfig.maxUploadSizeString = 'Unlimited';
      }

    } catch (error) {
      console.error(error);
      appConfig = { maxUploadCount: Infinity, maxUploadSize: Infinity, maxUploadSizeString: 'Unlimited' };
      showToast(error.message, true);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleRealtimeUpdate(message);
      } catch (error) { console.error("Failed to parse WebSocket message", error); }
    };
    socket.onopen = () => console.log("WebSocket connected");
    socket.onclose = () => {
      console.log("WebSocket disconnected Trying to reconnect...");
      setTimeout(connectWebSocket, 3000);
    };
    socket.onerror = (err) => console.error("WebSocket error", err);
  };

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const showToast = (message, isError = false) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.textContent = message.endsWith('.') ? message.slice(0, -1) : message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  };

  const router = () => {
    const path = window.location.hash.slice(1) || "/";
    mainContent.innerHTML = "";
    if (path === "/videos") {
      renderVideosPage();
    } else {
      renderHomePage();
    }
  };

  const fetchVideos = async () => {
    if (allVideos.length > 0) return allVideos;
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || `Failed to load videos Status: ${res.status}`);
      }
      const data = await res.json();
      allVideos = data.data.videos || [];
      return allVideos;
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not load videos Please refresh the page", true);
      return [];
    }
  };

  const createVideoCard = (video) => {
    const card = document.createElement("div");
    card.className = "video-card";
    card.dataset.uuid = video.uuid;
    card.onclick = () => openModal(video);

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'video-thumbnail-container';

    if (video.thumbnail) {
        const img = document.createElement('img');
        img.src = video.thumbnail;
        img.alt = video.title;
        img.className = 'video-thumbnail';
        img.loading = 'lazy';
        thumbnailContainer.appendChild(img);
    } else {
        const noThumbnail = document.createElement('div');
        noThumbnail.className = 'no-thumbnail';
        noThumbnail.textContent = 'No thumbnail';
        thumbnailContainer.appendChild(noThumbnail);
    }

    const videoInfo = document.createElement('div');
    videoInfo.className = 'video-info';

    const infoText = document.createElement('div');

    const title = document.createElement('h3');
    title.className = 'video-title';
    title.textContent = video.title;

    const date = document.createElement('p');
    date.className = 'video-date';
    date.textContent = new Date(video.created_at).toLocaleString();

    infoText.appendChild(title);
    infoText.appendChild(date);

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.title = 'Copy share link';

    const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    copyButton.innerHTML = copyIconSVG;

    copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = new URL(video.share_url, window.location.origin).toString();
        navigator.clipboard.writeText(url).then(() => {
            showToast("Link copied to clipboard!");
            copyButton.innerHTML = checkIconSVG;
            setTimeout(() => {
                copyButton.innerHTML = copyIconSVG;
            }, 2000);
        }).catch(() => showToast("Could not copy link", true));
    });

    videoInfo.appendChild(infoText);
    videoInfo.appendChild(copyButton);

    card.appendChild(thumbnailContainer);
    card.appendChild(videoInfo);

    return card;
  };

  const renderVideoGrid = (gridElement, videosToRender) => {
    gridElement.innerHTML = '';
    if (videosToRender.length > 0) {
      videosToRender.forEach(video => {
        gridElement.appendChild(createVideoCard(video));
      });
    } else {
      gridElement.innerHTML = `<div class="empty-state">Be the first to drop a video</div>`;
    }
  };

  const handleRealtimeUpdate = ({ type, payload }) => {
    let needsRender = false;
    if (type === 'video:added') {
      if (!allVideos.some(v => v.uuid === payload.uuid)) {
        showToast(`New video added: ${payload.title}`);
        allVideos.unshift(payload);
        needsRender = true;
      }
    }
    if (type === 'video:deleted') {
      const index = allVideos.findIndex(v => v.uuid === payload.uuid);
      if (index > -1) {
        showToast(`Removed: ${allVideos[index].title || 'a video'}`);
        allVideos.splice(index, 1);
        needsRender = true;
      }
    }
    if (needsRender) {
      const currentGrid = document.getElementById("videos-grid") || document.getElementById("latest-videos");
      if (currentGrid) {
        const videosForCurrentView = currentGrid.id === 'latest-videos' ? allVideos.slice(0, 8) : allVideos;
        renderVideoGrid(currentGrid, videosForCurrentView);
      }
    }
  };

  const setupUploadForm = () => {
    const uploadFormContainer = document.getElementById('upload-form-container');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('videoFile');
    const titleInput = document.getElementById('title');
    const fileNameSpan = document.getElementById('file-name');
    const fileListContainer = document.getElementById('file-list-container');
    const uploadButton = document.getElementById('upload-button');
    const cancelButton = document.getElementById('cancel-button');

    const trashIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6m3 0V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

    const overlayContent = uploadFormContainer.querySelector('.drag-overlay-content');
    if (!overlayContent) {
        console.error('Drag overlay content element not found');
        return;
    }
    const dragOverlayDetails = overlayContent.querySelector('.drag-overlay-details');
    if (!dragOverlayDetails) {
        console.error('Drag overlay details element not found');
        return;
    }

    const renderFileList = () => {
      fileListContainer.innerHTML = '';
      if (filesToUpload.length > 0) {
        fileNameSpan.textContent = `${filesToUpload.length} ${filesToUpload.length === 1 ? 'file' : 'files'} selected`;
      } else {
        fileNameSpan.textContent = 'No file chosen';
      }

      filesToUpload.forEach(fileObj => {
        const item = document.createElement('div');
        item.className = 'file-list-item';
        item.id = fileObj.id;

        item.innerHTML = `
          <div class="file-list-name">${fileObj.file.name}</div>
          <div class="file-progress-container">
            <div class="file-progress-bar"></div>
          </div>
          <button type="button" class="file-list-remove" title="Remove file">${trashIconSVG}</button>
        `;

        item.querySelector('.file-list-remove').addEventListener('click', () => {
          removeFileFromQueue(fileObj.id);
        });

        fileListContainer.appendChild(item);
      });
    };

    const addFilesToQueue = (newFiles) => {
      for (const file of newFiles) {

        if (filesToUpload.length >= appConfig.maxUploadCount) {
          showToast(`Cannot add more files Max upload count is ${appConfig.maxUploadCount}`, true);
          break;
        }

        if (file.size > appConfig.maxUploadSize) {
          showToast(`File "${file.name}" is too large Max size is ${appConfig.maxUploadSizeString}`, true);
          continue;
        }

        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        filesToUpload.push({ id: fileId, file });
      }

      renderFileList();
    };

    const removeFileFromQueue = (fileId) => {
      filesToUpload = filesToUpload.filter(f => f.id !== fileId);
      renderFileList();
    };

    const updateOverallProgress = () => {
      let totalLoaded = 0;
      let totalSize = 0;

      for (const id in uploadProgress) {
        totalLoaded += uploadProgress[id].loaded;
        totalSize += uploadProgress[id].total;
      }

      if (totalSize === 0) {
        uploadButton.textContent = 'Uploading 0%';
        return;
      }

      const totalProgress = Math.min(Math.floor((totalLoaded / totalSize) * 100), 100);
      uploadButton.textContent = `Uploading ${totalProgress}%`;
    };

    const uploadFileInQueue = async (fileObj, baseTitle) => {
      const { id, file } = fileObj;
      const fileItemElem = document.getElementById(id);
      const progressBar = fileItemElem.querySelector('.file-progress-bar');

      uploadProgress[id] = { loaded: 0, total: file.size };
      let totalUploadedForThisFile = 0;

      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `${file.name}-${Date.now()}`;
      const sanitizedFileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');

      const uploadChunk = (chunkIndex) => {
        return new Promise((resolve, reject) => {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const xhr = new XMLHttpRequest();
          activeUploadXHRs[id] = xhr;

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

          let lastChunkUploadedBytes = 0;
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const chunkUploadedBytes = event.loaded;
              const progressSinceLastEvent = chunkUploadedBytes - lastChunkUploadedBytes;

              uploadProgress[id].loaded = totalUploadedForThisFile + chunkUploadedBytes;
              lastChunkUploadedBytes = chunkUploadedBytes;

              const percent = (uploadProgress[id].loaded / file.size) * 100;
              progressBar.style.width = `${percent}%`;

              updateOverallProgress();
            }
          };

          xhr.onload = () => {
            delete activeUploadXHRs[id];
            if (xhr.status >= 200 && xhr.status < 300) {
              totalUploadedForThisFile += chunk.size;
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
            delete activeUploadXHRs[id];
            reject(new Error(`Network error during upload of ${file.name}`));
          };
          xhr.onabort = () => {
            delete activeUploadXHRs[id];
            reject(new Error('Upload aborted'));
          };

          xhr.send(chunk);
        });
      };

      try {
        for (let i = 0; i < totalChunks; i++) {
          const response = await uploadChunk(i);
          if (i === totalChunks - 1) {
            progressBar.style.width = '100%';
          }
        }
        return file.name;
      } catch (error) {
        progressBar.style.backgroundColor = 'red';
        throw error;
      }
    };

    fileInput.addEventListener('change', () => {
      addFilesToQueue(fileInput.files);
      fileInput.value = '';
    });

    cancelButton.addEventListener('click', () => {
      Object.values(activeUploadXHRs).forEach(xhr => xhr.abort());
      activeUploadXHRs = {};
      uploadButton.disabled = false;
      uploadButton.textContent = 'Upload';
      cancelButton.style.display = 'none';
      uploadForm.classList.remove('is-uploading');
      showToast('Upload cancelled', true);
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (filesToUpload.length === 0) {
        showToast('Please add files to upload first', true);
        return;
      }

      const baseTitle = titleInput.value;
      const initialFileCount = filesToUpload.length;

      uploadButton.disabled = true;
      cancelButton.style.display = 'inline-flex';
      uploadForm.classList.add('is-uploading');
      uploadProgress = {};

      filesToUpload.forEach(f => {
        uploadProgress[f.id] = { loaded: 0, total: f.file.size };
      });
      updateOverallProgress();

      const uploadPromises = filesToUpload.map(fileObj =>
        uploadFileInQueue(fileObj, baseTitle)
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
        if (error.message.includes('aborted')) {
        } else {
          showToast(`An unexpected error occurred: ${error.message}`, true);
        }
        console.error("Upload error", error);
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload';
        cancelButton.style.display = 'none';
        uploadForm.classList.remove('is-uploading');
        uploadForm.reset();
        filesToUpload = [];
        activeUploadXHRs = {};
        uploadProgress = {};
        renderFileList();
      }
    });

    uploadFormContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        let detailsText = `Drop files here`;
        if (isFinite(appConfig.maxUploadCount)) {
            detailsText += ` Up to ${appConfig.maxUploadCount} files`;
        }
        if (isFinite(appConfig.maxUploadSize) && appConfig.maxUploadSizeString !== 'Unlimited') {
             detailsText += ` Max ${appConfig.maxUploadSizeString} per file`;
        }
        if (detailsText !== 'Drop files here' && /\w$/.test(detailsText)) {
            detailsText += '.';
        }

        dragOverlayDetails.textContent = detailsText.endsWith('.') ? detailsText.slice(0,-1) : detailsText;
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

  const renderHomePage = async () => {
    mainContent.innerHTML = `
      <section class="hero-section">
        <div class="container hero-content lg-flex-row">
          <div class="hero-text">
            <h1 class="hero-title md-text-6xl">Share worthy video gallery for your gaming montages</h1>
            <p class="hero-description">Upload clips We generate thumbnails, stream instantly with buffering, and make sharing a breeze</p>
            <div class="hero-actions">
              <a href="#upload-section" id="upload-cta-btn" class="button">Upload a clip</a>
              <a href="#/videos" class="button button-outline">Browse videos</a>
            </div>
          </div>
          <div class="hero-image-container"><img src="/image.gif" alt="highlight-asset" class="hero-image"></div>
        </div>
      </section>

      <section id="upload-section" class="section-py">
        <div class="container">
          <div id="upload-form-container" class="upload-form-container">
            <h2>Add new video</h2>
            <form id="upload-form" class="upload-form">
              <div class="form-group">
                <label for="videoFile">Upload file(s)</label>
                <p class="input-hint">Supported: MP4, WEBM, MKV, AVI, MOV</p>
              </div>
              <div class="form-group">
                <label for="title">Title (optional)</label>
                <input type="text" id="title" name="title" class="input-field" placeholder="What’s this clip all about?" maxlength="100">
                <p class="input-hint">If uploading multiple files, this title will be applied to all of them if provided</p>
              </div>
              <div class="form-group">
                <div class="file-input-wrapper">
                  <label for="videoFile" class="file-input-label">Choose File(s)</label>
                  <input type="file" id="videoFile" name="videoFile" accept="video/mp4,video/webm,video/x-matroska,video/quicktime,video/x-msvideo" multiple>
                  <span class="file-name" id="file-name">No file chosen</span>
                </div>
              </div>

              <div id="file-list-container"></div>

              <div class="upload-actions" style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
                <button type="submit" id="upload-button" class="button upload-button" style="width: 100%;">Upload</button>
                <button type="button" id="cancel-button" class="button button-outline" style="display: none;">Cancel</button>
              </div>
            </form>
            
          </div>
        </div>
      </section>

      <section id="latest-videos-section" class="section-py">
        <div class="container">
          <div class="section-header"><h2 class="section-title">Latest Videos</h2><a href="#/videos" class="section-link">View all</a></div>
          <div id="latest-videos" class="video-grid sm-grid-cols-2 md-grid-cols-3 lg-grid-cols-4"></div>
        </div>
      </section>
    `;

    const uploadFormContainer = document.getElementById('upload-form-container');
    if (uploadFormContainer) {
        const overlayContent = document.createElement('div');
        overlayContent.className = 'drag-overlay-content';
        overlayContent.innerHTML = `
            <div class="drag-overlay-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="drag-overlay-title">Upload files</div>
            <div class="drag-overlay-details"></div>
        `;
        uploadFormContainer.appendChild(overlayContent);
    }


    document.getElementById('upload-cta-btn').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (!appConfig.maxUploadCount) {
        await fetchAppConfig();
    }
    setupUploadForm();

    await fetchVideos();
    const latestVideosContainer = document.getElementById("latest-videos");
    if(latestVideosContainer) {
      renderVideoGrid(latestVideosContainer, allVideos.slice(0, 8));
    }
  };

  const renderVideosPage = async () => {
    mainContent.innerHTML = `
        <div class="container section-py">
            <div class="videos-page-header">
                <div><h1 class="videos-page-title">Videos</h1><p class="videos-page-description">Explore your gaming montage clips</p></div>
                <button id="refresh-btn" class="button button-outline">Refresh</button>
            </div>
            <div id="videos-grid" class="video-grid sm-grid-cols-2 md-grid-cols-3 lg-grid-cols-4 xl-grid-cols-5"></div>
        </div>
    `;
    document.getElementById('refresh-btn').addEventListener('click', () => {
        allVideos = [];
        renderVideosPage();
    });
    await fetchVideos();
    const videosGrid = document.getElementById("videos-grid");
    if(videosGrid) {
      renderVideoGrid(videosGrid, allVideos);
    }
  };

  const openModal = (video) => {
    const streamingUrl = video.streaming_url || `/s/${video.uuid}`;
    videoPlayer.src = streamingUrl;
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    modal.style.display = 'none';
  };

  const handleHomeNavigation = (e) => {
    e.preventDefault();
    const isHomePage = window.location.hash === '' || window.location.hash === '#/';
    if (isHomePage) {
      window.location.reload();
    } else {
      window.location.href = '/';
    }
  };

  logoLink.addEventListener('click', handleHomeNavigation);
  homeLink.addEventListener('click', handleHomeNavigation);

  modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
  });

  window.addEventListener("hashchange", router);

  await fetchAppConfig();
  router();
  connectWebSocket();
});