import { COPY_ICON, CHECK_ICON } from './icons.js';
import { showToast } from './toast.js';

export const createVideoCard = (video, onCardClick) => {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.uuid = video.uuid;
  card.onclick = () => onCardClick(video);

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
  copyButton.innerHTML = COPY_ICON;

  copyButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = new URL(video.share_url, window.location.origin).toString();
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
      copyButton.innerHTML = CHECK_ICON;
      setTimeout(() => {
        copyButton.innerHTML = COPY_ICON;
      }, 2000);
    }).catch(() => showToast('Could not copy link', true));
  });

  videoInfo.appendChild(infoText);
  videoInfo.appendChild(copyButton);
  card.appendChild(thumbnailContainer);
  card.appendChild(videoInfo);

  return card;
};
