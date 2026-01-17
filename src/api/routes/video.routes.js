import { Router } from 'express';
import * as videoController from '../controllers/video.controller.js';
import { validateUuid } from '../middlewares/validator.js';

const router = Router();

router.get('/api/config', videoController.getAppConfig);

router.post('/api/upload', videoController.uploadVideoChunk);
router.post('/api/upload-cancel', videoController.cancelUpload);

router.get('/api/videos', videoController.getVideos);
router.get('/s/:uuid', validateUuid, videoController.streamVideo);
router.get('/share/:uuid', validateUuid, videoController.getSharePage);

export default router;