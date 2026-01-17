import { escapeHtml } from '../utils/escape.js';

export const getSharePageHtml = (video, baseUrl) => {
  const videoUrl = `${baseUrl}/s/${video.uuid}`;
  const thumbnailUrl = `${baseUrl}${video.thumbnail}`;
  const shareUrl = `${baseUrl}/share/${video.uuid}`;

  const safeTitle = escapeHtml(video.title);
  const safeVideoUrl = escapeHtml(videoUrl);
  const safeThumbnailUrl = escapeHtml(thumbnailUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeWidth = escapeHtml(video.width || 1280);
  const safeHeight = escapeHtml(video.height || 720);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle}</title>
        <meta name="twitter:card" content="player">
        <meta name="twitter:title" content="${safeTitle}">
        <meta name="twitter:player" content="${safeVideoUrl}">
        <meta name="twitter:player:width" content="${safeWidth}">
        <meta name="twitter:player:height" content="${safeHeight}">
        <meta name="twitter:image" content="${safeThumbnailUrl}">
        <meta property="og:type" content="video.other">
        <meta property="og:description" content="Watch this clip on Clypse!">
        <meta property="og:title" content="${safeTitle}">
        <meta property="og:url" content="${safeShareUrl}">
        <meta property="og:image" content="${safeThumbnailUrl}">
        <meta property="og:video" content="${safeVideoUrl}">
        <meta property="og:video:secure_url" content="${safeVideoUrl}">
        <meta property="og:video:type" content="video/mp4">
        <meta property="og:video:width" content="${safeWidth}">
        <meta property="og:video:height" content="${safeHeight}">
        <style>
            html, body { background-color: #000; margin: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
            video { width: 100%; height: 100%; object-fit: contain; }
        </style>
    </head>
    <body>
        <video controls autoplay playsinline src="${safeVideoUrl}"></video>
    </body>
    </html>`;
};