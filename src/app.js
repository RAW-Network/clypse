import express from 'express';
import helmet from 'helmet';
import path from 'path';
import config from './config/index.js';
import videoRoutes from './api/routes/video.routes.js';
import errorHandler from './api/middlewares/errorHandler.js';
import ApiError from './utils/ApiError.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  frameguard: false
}));

app.use('/api/upload', express.raw({
  type: 'application/octet-stream',
  limit: '100mb'
}));

app.use(express.json()); 
app.use(express.static(config.paths.public));
app.use('/videos/thumbnails', express.static(config.paths.thumbnails));

app.use(videoRoutes);

app.use((req, res, next) => {
  next(new ApiError(404, `Can't find ${req.originalUrl} on this server!`));
});

app.use(errorHandler);

export default app;