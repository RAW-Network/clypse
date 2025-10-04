document.addEventListener("DOMContentLoaded", () => {
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

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleRealtimeUpdate(message);
      } catch (error) { console.error("Failed to parse WebSocket message:", error); }
    };
    socket.onopen = () => console.log("WebSocket connected.");
    socket.onclose = () => {
      console.log("WebSocket disconnected. Trying to reconnect...");
      setTimeout(connectWebSocket, 3000);
    };
    socket.onerror = (err) => console.error("WebSocket error:", err);
  };

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  
  const showToast = (message, isError = false) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.textContent = message;
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
          throw new Error(errorData.message || `Failed to load videos. Status: ${res.status}`);
      }
      const data = await res.json();
      allVideos = data.data.videos || [];
      return allVideos;
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not load videos. Please refresh the page", true);
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
      gridElement.innerHTML = `<div class="empty-state">Be the first to drop a video!</div>`;
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
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('videoFile');
    const titleInput = document.getElementById('title');
    const fileNameSpan = document.getElementById('file-name');
    const uploadButton = document.getElementById('upload-button');
    const cancelButton = document.getElementById('cancel-button');
    let currentXHR = null;
    let totalUploaded = 0;

    fileInput.addEventListener('change', () => {
      fileNameSpan.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file chosen';
    });

    cancelButton.addEventListener('click', () => {
      if (currentXHR) {
        currentXHR.abort();
      }
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      const title = titleInput.value;
      if (!file) {
        showToast('Please select a video file to upload', true);
        return;
      }
      
      uploadButton.disabled = true;
      cancelButton.style.display = 'inline-flex';
      totalUploaded = 0;

      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `${file.name}-${Date.now()}`;
      const sanitizedFileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');

      const uploadChunk = (chunkIndex) => {
        return new Promise((resolve, reject) => {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          currentXHR = new XMLHttpRequest();
          currentXHR.open('POST', '/api/upload', true);

          currentXHR.setRequestHeader('Content-Type', 'application/octet-stream');
          currentXHR.setRequestHeader('X-Upload-ID', uploadId);
          currentXHR.setRequestHeader('X-Chunk-Index', String(chunkIndex));
          currentXHR.setRequestHeader('X-Total-Chunks', String(totalChunks));
          currentXHR.setRequestHeader('X-File-Name', sanitizedFileName);
          currentXHR.setRequestHeader('X-File-Size', String(file.size));

          if (chunkIndex === totalChunks - 1 && title) {
            currentXHR.setRequestHeader('X-File-Title', encodeURIComponent(title));
          }
          
          let lastChunkUploadedBytes = 0;
          currentXHR.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const chunkUploadedBytes = event.loaded;
              const progressSinceLastEvent = chunkUploadedBytes - lastChunkUploadedBytes;
              totalUploaded += progressSinceLastEvent;
              lastChunkUploadedBytes = chunkUploadedBytes;
              
              const totalProgress = Math.min(Math.floor((totalUploaded / file.size) * 100), 100);
              uploadButton.textContent = `Uploading... ${totalProgress}%`;
            }
          };

          currentXHR.onload = () => {
            if (currentXHR.status >= 200 && currentXHR.status < 300) {
              resolve(currentXHR.response);
            } else {
              let errorMsg = `Upload failed with status: ${currentXHR.status}`;
              try {
                errorMsg = JSON.parse(currentXHR.responseText).message || errorMsg;
              } catch (e) {}
              reject(new Error(errorMsg));
            }
          };

          currentXHR.onerror = () => reject(new Error('Network error during upload'));
          currentXHR.onabort = () => reject(new Error('Upload aborted'));

          currentXHR.send(chunk);
        });
      };
      
      try {
        for (let i = 0; i < totalChunks; i++) {
          const response = await uploadChunk(i);
          if (i === totalChunks - 1) {
            uploadButton.textContent = 'Processing...';
            const result = JSON.parse(response);
            showToast(result.message);
          }
        }
        uploadForm.reset();
        fileNameSpan.textContent = 'No file chosen';
      } catch (error) {
          if (error.message.includes('aborted')) {
            showToast('Upload cancelled', true);
            await fetch('/api/upload-cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uploadId }),
            });
          } else {
            showToast(error.message, true);
          }
          console.error("Upload error:", error);
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload';
        cancelButton.style.display = 'none';
        currentXHR = null;
      }
    });
  };

  const renderHomePage = async () => {
    mainContent.innerHTML = `
      <section class="hero-section">
        <div class="container hero-content lg-flex-row">
          <div class="hero-text">
            <h1 class="hero-title md-text-6xl">Share worthy video gallery for your gaming montages</h1>
            <p class="hero-description">Upload clips. We generate thumbnails, stream instantly with buffering, and make sharing a breeze.</p>
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
          <div class="upload-form-container">
            <h2>Add new video</h2>
            <form id="upload-form" class="upload-form">
              <div class="form-group">
                <label for="videoFile">Upload file</label>
                <p class="input-hint">Supported: MP4, WEBM, MKV, AVI, MOV</p>
              </div>
              <div class="form-group">
                <label for="title">Title (optional)</label>
                <input type="text" id="title" name="title" class="input-field" placeholder="What’s this clip all about?" maxlength="100">
              </div>
              <div class="form-group">
                <div class="file-input-wrapper">
                  <label for="videoFile" class="file-input-label">Choose File</label>
                  <input type="file" id="videoFile" name="videoFile" accept="video/mp4,video/webm,video/x-matroska,video/quicktime,video/x-msvideo">
                  <span class="file-name" id="file-name">No file chosen</span>
                </div>
              </div>
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

    document.getElementById('upload-cta-btn').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    
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
                <div><h1 class="videos-page-title">Videos</h1><p class="videos-page-description">Explore your gaming montage clips.</p></div>
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
    videoPlayer.src = '';
    modal.style.display = 'none';
  };
  
  const handleHomeNavigation = (e) => {
    e.preventDefault();
    window.location.reload();
  };

  logoLink.addEventListener('click', handleHomeNavigation);
  homeLink.addEventListener('click', handleHomeNavigation);
  
  modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
  });

  window.addEventListener("hashchange", router);
  
  router();
  connectWebSocket();
});