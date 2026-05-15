const jwt = require('jsonwebtoken');

const JWT_AUDIENCE = 'financials';
const JWT_ISSUER = 'financials-api';
const DEFAULT_EXPIRES_IN = process.env.FINANCIALS_JWT_EXPIRES_IN || '12h';

const getJwtSecret = () => {
  const secret =
    process.env.FINANCIALS_JWT_SECRET ||
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? null : 'dev-financials-jwt-secret');

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FINANCIALS_JWT_SECRET or JWT_SECRET must be set in production');
  }

  return secret || 'dev-financials-jwt-secret';
};

const PUBLIC_API_PATHS = new Set([
  '/api/health',
  '/api/login',
  '/api/forgot-password',
  '/api/reset-password',
]);

const isJwtRequired = () => process.env.FINANCIALS_REQUIRE_JWT !== 'false';

/** When true, every protected /api route must send a valid Financials Bearer token (disable if VMS shares this API). */
const isStrictApi = () => process.env.FINANCIALS_STRICT_API === 'true';

const signFinancialsToken = (user) => {
  const payload = {
    sub: String(user.id),
    name: user.name,
    designation: user.designation,
    business_unit: user.business_unit,
    email: user.email,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: DEFAULT_EXPIRES_IN,
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
};

const verifyFinancialsToken = (token) =>
  jwt.verify(token, getJwtSecret(), {
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });

const attachFinancialsUser = (decoded) => ({
  id: decoded.sub,
  name: decoded.name,
  designation: decoded.designation,
  business_unit: decoded.business_unit,
  email: decoded.email,
});

const requireFinancialsAuth = (req, res, next) => {
  if (!isJwtRequired()) {
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  // No Bearer token: allow unless strict mode (VMS on another API can set FINANCIALS_STRICT_API=true)
  if (scheme !== 'Bearer' || !token) {
    if (isStrictApi()) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    return next();
  }

  try {
    const decoded = verifyFinancialsToken(token);
    req.financialsUser = attachFinancialsUser(decoded);
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
    });
  }
};

const financialsApiAuthMiddleware = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const path = req.path || req.url.split('?')[0];
  if (!path.startsWith('/api')) {
    return next();
  }

  if (PUBLIC_API_PATHS.has(path)) {
    return next();
  }

  return requireFinancialsAuth(req, res, next);
};

module.exports = {
  signFinancialsToken,
  verifyFinancialsToken,
  requireFinancialsAuth,
  financialsApiAuthMiddleware,
  PUBLIC_API_PATHS,
};
