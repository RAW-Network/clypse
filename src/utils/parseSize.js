const parseSize = (sizeString) => {
  if (typeof sizeString !== 'string' || sizeString.length === 0) {
    return Infinity;
  }

  const units = {
    B: 1,
    K: 1024,
    M: 1024 * 1024,
    G: 1024 * 1024 * 1024,
  };

  const regex = /^(\d+)([BKMGT])?$/i;
  const match = sizeString.toUpperCase().match(regex);

  if (!match) {
    return Infinity;
  }

  const size = parseInt(match[1], 10);
  const unit = match[2] || 'B';

  return size * (units[unit] || 1);
};

const formatSize = (bytes) => {
  if (bytes === Infinity) return 'Unlimited';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export { parseSize, formatSize };