const prisma = require('../prisma');

const SENSITIVE_KEYS = ['password', 'token', 'tempToken', 'totp_secret'];

/**
 * Recursively redacts sensitive keys from an object or array.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Global middleware that overrides res.send to log transaction metadata.
 * Implements a fail-closed policy (rejects requests with HTTP 500 if logging fails).
 */
function auditLogger(req, res, next) {
  let logged = false;
  const originalSend = res.send;

  res.send = async function (body) {
    if (logged) {
      return originalSend.call(this, body);
    }
    logged = true;

    // Check if route is an audit target (protected routes OR login/register flows)
    const url = req.originalUrl.split('?')[0];
    const isAuditTarget = 
      req.user || 
      url === '/api/auth/login' || 
      url === '/api/admin/login' || 
      url === '/api/auth/register' || 
      url === '/api/auth/2fa/verify' ||
      url.startsWith('/api/admin') ||
      url.startsWith('/api/feed');

    if (!isAuditTarget) {
      return originalSend.call(this, body);
    }

    try {
      // Derive a clean action type: METHOD_PATH with dynamic IDs normalized
      let normalizedPath = req.baseUrl + req.path;
      // Normalize UUIDs to ':id'
      normalizedPath = normalizedPath.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':id');
      // Normalize numeric IDs to ':id'
      normalizedPath = normalizedPath.replace(/\/\d+/g, '/:id');
      
      const cleanPath = normalizedPath.replace(/^\//, '').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
      const action_type = `${req.method}_${cleanPath}`;

      // Identify actor: authenticated user info OR input email/anonymous
      const actor_id = req.user ? req.user.id : (req.body?.email || 'anonymous');
      const actor_type = req.user ? req.user.role : 'GUEST';

      // Parse outcome and response payload
      const outcome = res.statusCode >= 400 ? 'failure' : 'success';
      let parsedResponseBody = {};
      try {
        parsedResponseBody = JSON.parse(body);
      } catch (err) {
        parsedResponseBody = { raw: body };
      }

      // Build details payload and sanitize sensitive inputs
      const details = {
        method: req.method,
        path: req.path,
        routeParams: req.params,
        queryParams: req.query,
        statusCode: res.statusCode,
        outcome: outcome,
        requestBody: sanitizeObject(req.body),
        responseBody: sanitizeObject(parsedResponseBody)
      };

      // Write transaction to database log
      await prisma.activityLog.create({
        data: {
          actor_id,
          actor_type,
          action_type,
          details_json: details
        }
      });

      // Call the original res.send to return standard payload on success
      originalSend.call(this, body);

    } catch (err) {
      console.error('AUDIT SYSTEM EXCEPTION: Logging failure, aborting request.', err.message);
      
      // Fail closed: Send a 500 error aborting the primary transaction
      res.status(500);
      originalSend.call(this, JSON.stringify({ 
        error: 'Audit log write failed. Transaction aborted for security compliance.' 
      }));
    }
  };

  next();
}

module.exports = auditLogger;
