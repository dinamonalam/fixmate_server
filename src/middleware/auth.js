const jwt = require('jsonwebtoken');
const { getCollections } = require('../config/db');

/**
 * Verify JWT Token Middleware
 * Extracts bearer token from headers, verifies it, and attaches the user document to req.user.
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Access token is missing or malformed.',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fixmate_super_secret_jwt_key_2026_secure_tokens';

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired token.',
      });
    }

    const { usersCollection } = getCollections();
    const user = await usersCollection.findOne({ email: decoded.email?.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User account not found.',
      });
    }

    // Attach sanitized user to request object
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image || '',
      phone: user.phone || '',
      area: user.area || '',
      bio: user.bio || '',
    };

    next();
  } catch (error) {
    console.error('Error in verifyToken middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
}

/**
 * Verify Customer Role Middleware
 */
function verifyCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to customers only.',
    });
  }
  next();
}

/**
 * Verify Technician Role Middleware
 */
function verifyTechnician(req, res, next) {
  if (!req.user || req.user.role !== 'technician') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to technicians only.',
    });
  }
  next();
}

/**
 * Verify Admin Role Middleware
 */
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to platform administrators only.',
    });
  }
  next();
}

module.exports = {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
  verifyAdmin,
};
