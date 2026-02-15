/**
 * RATE LIMITER MIDDLEWARE
 */

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por ventana
    message: {
        success: false,
        message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde',
            retryAfter: req.rateLimit.resetTime
        });
    }
});

module.exports = limiter;
