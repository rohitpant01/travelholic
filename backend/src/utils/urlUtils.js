/**
 * Helper to get the correct base URL for image proxying
 * Priority: 
 * 1. process.env.BACKEND_URL (if defined)
 * 2. Dynamic request object (protocol + host)
 * 3. Fallback to production URL (last resort)
 */
exports.getBaseUrl = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  if (req && req.get) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    return `${protocol}://${host}`;
  }
  return 'https://travelholic-zsqn.onrender.com'; // Absolute fallback
};
