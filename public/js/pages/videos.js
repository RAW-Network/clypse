import * as store from '../state/store.js';
import { fetchVideos } from '../services/api.js';
import { renderVideoGrid } from '../components/video-grid.js';

export const renderVideosPage = async (mainContent, openModal) => {
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
    store.clearVideos();
    renderVideosPage(mainContent, openModal);
  });

  await fetchVideos();
  const videosGrid = document.getElementById('videos-grid');
  if (videosGrid) {
    renderVideoGrid(videosGrid, store.getVideos(), openModal);
  }
};
