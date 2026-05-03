export const initModal = () => {
  const modal = document.getElementById('video-modal');
  const videoPlayer = document.getElementById('video-player');

  const open = (video) => {
    const streamingUrl = video.streaming_url || `/s/${video.uuid}`;
    videoPlayer.src = streamingUrl;
    modal.style.display = 'flex';
  };

  const close = () => {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    modal.style.display = 'none';
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return { open, close };
};
