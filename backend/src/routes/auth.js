const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const prisma = require('../prisma');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

// Simple regex helper for email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 1. POST /api/auth/register
 * Validates email, password strength, hashes password, generates TOTP secret, creates user.
 */
router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  // Password strength: min 8 characters, at least 1 letter, and at least 1 number
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ 
      error: 'Password must be at least 8 characters long and contain both letters and numbers.' 
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash password with bcryptjs
    const password_hash = await bcrypt.hash(password, 10);

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `ToxicTwitter:${email}`,
      issuer: 'ToxicTwitterApp'
    });

    // Create User record
    const newUser = await prisma.user.create({
      data: {
        email,
        password_hash,
        role: 'USER',
        status: 'active',
        totp_secret: secret.base32
      }
    });

    // Generate QR code data URL (Base64)
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    return res.status(201).json({
      message: 'Registration successful. Please configure 2FA.',
      otpauth_url: secret.otpauth_url,
      qr_code: qrCodeDataUrl,
      totp_secret: secret.base32 // Exposed for testing and manual entry setup
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

/**
 * 2. POST /api/auth/login
 * Verifies credentials, issues short-lived tempToken pending 2FA.
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is suspended or inactive.' });
    }

    // Issue short-lived tempToken (expires in 5 minutes)
    const tempToken = jwt.sign(
      { userId: user.id, isTemp: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.status(200).json({
      message: 'Credentials verified. 2FA code verification required.',
      tempToken
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

/**
 * POST /api/admin/login
 * Verifies admin credentials, issues short-lived tempToken pending 2FA.
 */
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is suspended or inactive.' });
    }

    // Issue short-lived tempToken (expires in 5 minutes)
    const tempToken = jwt.sign(
      { userId: user.id, isTemp: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.status(200).json({
      message: 'Admin credentials verified. 2FA code verification required.',
      tempToken
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error during admin login.' });
  }
});

/**
 * 3. POST /api/auth/2fa/verify
 * Validates the 6-digit TOTP code against the stored user secret using tempToken.
 */
router.post('/auth/2fa/verify', async (req, res) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Temporary token and 2FA code are required.' });
  }

  try {
    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Temporary token is invalid or expired.' });
    }

    if (!payload.isTemp) {
      return res.status(400).json({ error: 'Invalid temporary token format.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User session has expired.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'User account is inactive.' });
    }

    if (!user.totp_secret) {
      return res.status(400).json({ error: '2FA secret not initialized. Please register first.' });
    }

    // Verify 6-digit TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1-step time drift (approx 30s discrepancy either way)
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA code. Please try again.' });
    }

    // Issue permanent full JWT access token (24h expiry)
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Authentication successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error during 2FA verification.' });
  }
});

module.exports = router;
