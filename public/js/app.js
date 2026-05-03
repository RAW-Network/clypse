import * as store from './state/store.js';
import { fetchAppConfig } from './services/api.js';
import { connectWebSocket } from './services/websocket.js';
import { initRouter } from './router/index.js';
import { initModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { renderVideoGrid } from './components/video-grid.js';
import { renderHomePage } from './pages/home.js';
import { renderVideosPage } from './pages/videos.js';

document.addEventListener('DOMContentLoaded', async () => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const mainContent = document.getElementById('main-content');
  const yearSpan = document.getElementById('year');
  const logoLink = document.getElementById('logo-link');
  const homeLink = document.getElementById('home-link');

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  const modal = initModal();

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

  const handleRealtimeUpdate = ({ type, payload }) => {
    let needsRender = false;

    if (type === 'video:added') {
      if (store.addVideo(payload)) {
        showToast(`New video added: ${payload.title}`);
        needsRender = true;
      }
    }

    if (type === 'video:deleted') {
      const removed = store.removeVideo(payload.uuid);
      if (removed) {
        showToast(`Removed: ${removed.title || 'a video'}`);
        needsRender = true;
      }
    }

    if (needsRender) {
      const currentGrid = document.getElementById('videos-grid') || document.getElementById('latest-videos');
      if (currentGrid) {
        const videosForCurrentView = currentGrid.id === 'latest-videos'
          ? store.getVideos().slice(0, 8)
          : store.getVideos();
        renderVideoGrid(currentGrid, videosForCurrentView, modal.open);
      }
    }
  };

  await fetchAppConfig();

  initRouter({
    '/': () => renderHomePage(mainContent, modal.open),
    '/videos': () => renderVideosPage(mainContent, modal.open),
  }, mainContent);

  connectWebSocket(handleRealtimeUpdate);
});
