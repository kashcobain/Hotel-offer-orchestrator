import { app } from './app';
import { config } from './config';
import { logger } from './logger';

app.listen(config.port, () => {
  logger.info(`Hotel Offer Orchestrator API listening on port ${config.port}`);
});
