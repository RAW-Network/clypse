import { showToast } from '../components/toast.js';
import * as store from '../state/store.js';

export const fetchAppConfig = async () => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      throw new Error('Failed to load app configuration');
    }
    const data = await res.json();
    const config = data.data;

    if (config.maxUploadCount === null || typeof config.maxUploadCount === 'undefined') {
      config.maxUploadCount = Infinity;
    }
    if (config.maxUploadSize === null || typeof config.maxUploadSize === 'undefined') {
      config.maxUploadSize = Infinity;
      config.maxUploadSizeString = 'Unlimited';
    }

    store.setConfig(config);
    return config;
  } catch (error) {
    console.error(error);
    const fallback = { maxUploadCount: Infinity, maxUploadSize: Infinity, maxUploadSizeString: 'Unlimited' };
    store.setConfig(fallback);
    showToast(error.message, true);
    return fallback;
  }
};

export const fetchVideos = async (forceRefresh = false) => {
  const cached = store.getVideos();
  if (cached.length > 0 && !forceRefresh) return cached;

  try {
    const res = await fetch('/api/videos');
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || `Failed to load videos Status: ${res.status}`);
    }
    const data = await res.json();
    const videos = data.data.videos || [];
    store.setVideos(videos);
    return videos;
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Could not load videos Please refresh the page', true);
    return [];
  }
};
