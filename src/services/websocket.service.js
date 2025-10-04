import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';

let wss;

export const initWebSocketServer = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected.');
    ws.on('close', () => logger.info('WebSocket client disconnected.'));
    ws.on('error', (error) => logger.error('WEBSOCKET_ERROR', { error: error.message }));
  });

  logger.info('WebSocket server initialized.');
};

export const broadcast = (data) => {
  if (!wss) {
    logger.warn('WebSocket server not initialized, cannot broadcast.');
    return;
  }

  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
};
