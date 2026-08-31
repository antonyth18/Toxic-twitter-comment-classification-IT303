const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

/**
 * Middleware to authenticate JWT tokens and attach user info to the request.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Reject short-lived tempTokens meant only for 2FA verification
    if (payload.isTemp) {
      return res.status(401).json({ error: '2FA verification required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User session invalid.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'User account is suspended or inactive.' });
    }

    // Exclude password hash from request user details
    const { password_hash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.' });
    }
    return res.status(403).json({ error: 'Invalid access token.' });
  }
}

/**
 * Middleware to restrict route access to ADMIN role only.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
