import * as svc from './service.js';
import { logger } from '../../core/logger.js';

export default {
  name: 'embedTemplates',
  version: '1.0.0',
  async init() {
    logger.info('embedTemplates module initialized');
  },
  service: svc,
};
