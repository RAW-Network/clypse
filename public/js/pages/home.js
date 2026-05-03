import * as store from '../state/store.js';
import { fetchAppConfig, fetchVideos } from '../services/api.js';
import { setupUploadForm } from '../components/upload-form.js';
import { renderVideoGrid } from '../components/video-grid.js';
import { UPLOAD_ICON } from '../components/icons.js';

export const renderHomePage = async (mainContent, openModal) => {
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
              <input type="text" id="title" name="title" class="input-field" placeholder="What's this clip all about?" maxlength="100">
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

            <div class="upload-actions">
              <button type="submit" id="upload-button" class="button upload-button">Upload</button>
              <button type="button" id="cancel-button" class="button button-outline">Cancel</button>
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

    const iconDiv = document.createElement('div');
    iconDiv.className = 'drag-overlay-icon';
    iconDiv.innerHTML = UPLOAD_ICON;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'drag-overlay-title';
    titleDiv.textContent = 'Upload files';

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'drag-overlay-details';

    overlayContent.appendChild(iconDiv);
    overlayContent.appendChild(titleDiv);
    overlayContent.appendChild(detailsDiv);
    uploadFormContainer.appendChild(overlayContent);
  }

  document.getElementById('upload-cta-btn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const config = store.getConfig();
  if (!config.maxUploadCount) {
    await fetchAppConfig();
  }
  setupUploadForm();

  await fetchVideos();
  const latestVideosContainer = document.getElementById('latest-videos');
  if (latestVideosContainer) {
    renderVideoGrid(latestVideosContainer, store.getVideos().slice(0, 8), openModal);
  }
};
