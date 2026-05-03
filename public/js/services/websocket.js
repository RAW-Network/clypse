const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 3000;

export const connectWebSocket = (onMessage) => {
  let reconnectDelay = BASE_RECONNECT_DELAY;

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);

    socket.onopen = () => {
      console.log('WebSocket connected');
      reconnectDelay = BASE_RECONNECT_DELAY;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    };

    socket.onclose = () => {
      console.log(`WebSocket disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    };

    socket.onerror = (err) => console.error('WebSocket error', err);
  };

  connect();
};
