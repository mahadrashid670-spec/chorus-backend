const jwt = require('jsonwebtoken');

// Protects routes: expects "Authorization: Bearer <token>".
// On success, attaches req.businessId for the route to use.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing login token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.businessId = payload.businessId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token, please log in again' });
  }
}

module.exports = { requireAuth };
