/**
 * LOGGER UTILITY - Sistema de Logging Robusto
 */

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const colors = {
    info: '\x1b[36m', // Cyan
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    success: '\x1b[32m', // Green
    reset: '\x1b[0m'
};

const formatMessage = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
};

const saveToFile = (level, formattedMessage) => {
    const logFile = path.join(logDir, 'app.log');
    fs.appendFileSync(logFile, formattedMessage + '\n');
};

const logger = {
    info: (message, meta = {}) => {
        const formatted = formatMessage('info', message, meta);
        console.log(`${colors.info}${formatted}${colors.reset}`);
        saveToFile('info', formatted);
    },
    warn: (message, meta = {}) => {
        const formatted = formatMessage('warn', message, meta);
        console.warn(`${colors.warn}${formatted}${colors.reset}`);
        saveToFile('warn', formatted);
    },
    error: (message, meta = {}) => {
        const formatted = formatMessage('error', message, meta);
        console.error(`${colors.error}${formatted}${colors.reset}`);
        saveToFile('error', formatted);
    },
    success: (message, meta = {}) => {
        const formatted = formatMessage('success', message, meta);
        console.log(`${colors.success}${formatted}${colors.reset}`);
        saveToFile('success', formatted);
    }
};

module.exports = logger;
