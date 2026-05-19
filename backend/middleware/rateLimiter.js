const rateLimit = require('express-rate-limit');
let ipKeyGenerator;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_) {}
const safeIpKeyGen = (req) => {
  if (typeof ipKeyGenerator === 'function') {
    try { return ipKeyGenerator(req); } catch (_) {}
  }
  return req.ip || 'unknown';
};

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI-specific rate limiter: 20 req/hour per user or IP
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => {
    return req.user?.id ? `user_${req.user.id}` : safeIpKeyGen(req);
  },
  message: { error: 'AI rate limit exceeded. Maximum 20 AI requests per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiRateLimiter, aiRateLimiter };
