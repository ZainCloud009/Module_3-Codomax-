const winston = require('winston');

// Structured logging - in production, CloudWatch Logs agent picks these up
// from stdout/stderr automatically when running on EC2.
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'cloud-webapp' },
  transports: [
    new winston.transports.Console(),
  ],
});

module.exports = logger;
