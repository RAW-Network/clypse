import { createVideoCard } from './video-card.js';

export const renderVideoGrid = (gridElement, videosToRender, onCardClick) => {
  gridElement.innerHTML = '';
  if (videosToRender.length > 0) {
    videosToRender.forEach(video => {
      gridElement.appendChild(createVideoCard(video, onCardClick));
    });
  } else {
    gridElement.innerHTML = `<div class="empty-state">Be the first to drop a video</div>`;
  }
};
