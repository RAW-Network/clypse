const getTimestamp = () => new Date().toISOString();

const log = (level, message, context = {}) => {
  const logObject = {
    timestamp: getTimestamp(),
    level: level.toUpperCase(),
    message,
    ...context,
  };
  console.log(JSON.stringify(logObject));
};

const logger = {
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
};

export default logger;
