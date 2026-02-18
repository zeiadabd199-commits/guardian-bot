import EventEmitter from 'events';
import { logger } from './logger.js';

const bus = new EventEmitter();

const originalEmit = bus.emit.bind(bus);
bus.emit = (eventName, ...args) => {
  try {
    logger.info(`Event emitted: ${eventName}`);
  } catch (e) {
    // swallow logger errors
  }
  return originalEmit(eventName, ...args);
};

bus.onEvent = (eventName, listener) => {
  logger.info(`Listener attached: ${eventName}`);
  bus.on(eventName, listener);
};

export default bus;
