const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getCollections } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fixmate_super_secret_jwt_key_2026_secure_tokens';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Validate password strength
 * At least 6 characters, 1 uppercase letter, 1 lowercase letter
 */
function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  return null;
}

/**
 * POST /api/auth/register
 * Register as Customer or Technician
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, area, bio, image } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // Role validation: Only 'customer' or 'technician' allowed; default to 'customer'
    let assignedRole = 'customer';
    if (role === 'technician') {
      assignedRole = 'technician';
    } else if (role === 'customer') {
      assignedRole = 'customer';
    } else if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Direct registration as admin is prohibited.',
      });
    }

    const { usersCollection } = getCollections();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultAvatar = assignedRole === 'technician'
      ? 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200&auto=format&fit=crop'
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop';

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      phone: phone || '',
      area: area || '',
      bio: bio || '',
      image: image || defaultAvatar,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    const userId = result.insertedId;

    const token = jwt.sign(
      {
        id: userId.toString(),
        email: normalizedEmail,
        role: assignedRole,
        name: newUser.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const sanitizedUser = {
      _id: userId,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      area: newUser.area,
      bio: newUser.bio,
      image: newUser.image,
      createdAt: newUser.createdAt,
    };

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while registering user.',
    });
  }
});

/**
 * POST /api/auth/login
 * User login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const { usersCollection } = getCollections();
    const normalizedEmail = email.trim().toLowerCase();

    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const sanitizedUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      area: user.area || '',
      bio: user.bio || '',
      image: user.image || '',
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during sign in.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current logged in user
 */
router.get('/me', verifyToken, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * PUT /api/auth/profile
 * Update profile information (name, phone, area, bio, image)
 */
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, area, bio, image } = req.body;
    const { usersCollection } = getCollections();

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (area !== undefined) updateFields.area = area.trim();
    if (bio !== undefined) updateFields.bio = bio.trim();
    if (image !== undefined) updateFields.image = image.trim();

    updateFields.updatedAt = new Date();

    const result = await usersCollection.findOneAndUpdate(
      { email: req.user.email },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    const updatedUser = result.value || (await usersCollection.findOne({ email: req.user.email }));

    const sanitizedUser = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone || '',
      area: updatedUser.area || '',
      bio: updatedUser.bio || '',
      image: updatedUser.image || '',
    };

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: sanitizedUser,
    });
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user profile.',
    });
  }
});

module.exports = router;
