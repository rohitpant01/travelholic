/**
 * Admin Authorization Middleware
 * 
 * Returns 404 instead of 403 to hide the existence of admin endpoints
 * from unauthorized users and external probes.
 */

// requireAdmin: allows admin + superadmin
const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    // Generic 404 — hides admin endpoint existence
    return res.status(404).json({ error: 'Route not found' });
  }
  next();
};

// requireSuperAdmin: only superadmin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(404).json({ error: 'Route not found' });
  }
  next();
};

module.exports = { requireAdmin, requireSuperAdmin };
