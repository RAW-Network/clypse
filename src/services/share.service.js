import { escapeHtml } from '../utils/escape.js';
import path from 'path';

const EXT_TO_MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
};

export const getSharePageHtml = (video, baseUrl) => {
  const fileExt = path.extname(video.file_name || '').toLowerCase() || '.mp4';
  const mimeType = EXT_TO_MIME[fileExt] || 'video/mp4';
  const videoUrl = `${baseUrl}/s/${video.uuid}${fileExt}`;
  const thumbnailUrl = `${baseUrl}${video.thumbnail}`;
  const shareUrl = `${baseUrl}/share/${video.uuid}`;

  const safeTitle = escapeHtml(video.title);
  const safeVideoUrl = escapeHtml(videoUrl);
  const safeThumbnailUrl = escapeHtml(thumbnailUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeWidth = escapeHtml(video.width || 1280);
  const safeHeight = escapeHtml(video.height || 720);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/favicon.ico">
    <title>${safeTitle}</title>
    <meta property="og:type" content="video.other">
    <meta property="og:site_name" content="Clypse">
    <meta property="og:url" content="${safeShareUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="Watch this clip on Clypse!">
    <meta property="og:image" content="${safeThumbnailUrl}">
    <meta property="og:video" content="${safeVideoUrl}">
    <meta property="og:video:secure_url" content="${safeVideoUrl}">
    <meta property="og:video:type" content="${mimeType}">
    <meta property="og:video:width" content="${safeWidth}">
    <meta property="og:video:height" content="${safeHeight}">
    <meta name="twitter:card" content="player">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:player" content="${safeShareUrl}">
    <meta name="twitter:player:width" content="${safeWidth}">
    <meta name="twitter:player:height" content="${safeHeight}">
    <meta name="twitter:player:stream" content="${safeVideoUrl}">
    <meta name="twitter:player:stream:content_type" content="${mimeType}">
    <meta name="twitter:image" content="${safeThumbnailUrl}">
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