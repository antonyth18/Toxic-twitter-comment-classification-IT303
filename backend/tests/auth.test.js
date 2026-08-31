const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/prisma');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');

describe('Authentication & 2FA Integration Tests', () => {
  const registerPayload = {
    email: 'new_user@test.com',
    password: 'Password123!'
  };

  const adminPayload = {
    email: 'test_admin@test.com',
    password: 'AdminPassword123!'
  };

  let savedUserSecret = '';
  let savedAdminSecret = '';
  let userTempToken = '';
  let adminTempToken = '';

  beforeAll(async () => {
    // Delete any leftover test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [registerPayload.email, adminPayload.email]
        }
      }
    });

    // Seed the admin user directly
    const bcrypt = require('bcryptjs');
    const hashedAdminPassword = await bcrypt.hash(adminPayload.password, 10);
    const adminSecret = speakeasy.generateSecret({ name: 'AdminTest' });
    savedAdminSecret = adminSecret.base32;

    await prisma.user.create({
      data: {
        email: adminPayload.email,
        password_hash: hashedAdminPassword,
        role: 'ADMIN',
        status: 'active',
        totp_secret: savedAdminSecret
      }
    });
  });

  afterAll(async () => {
    // Clean up test database records
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [registerPayload.email, adminPayload.email]
        }
      }
    });
    await prisma.$disconnect();
  });

  describe('1. Registration Flow: POST /api/auth/register', () => {
    it('should successfully register a new user and generate TOTP credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('otpauth_url');
      expect(res.body).toHaveProperty('qr_code');
      expect(res.body).toHaveProperty('totp_secret');
      
      savedUserSecret = res.body.totp_secret;
    });

    it('should block registration with invalid email formats', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid email address format.');
    });

    it('should reject registration if the password is too weak', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@test.com',
          password: 'no-numbers'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Password must be at least 8 characters');
    });

    it('should reject duplicate email registration attempts', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email is already registered.');
    });
  });

  describe('2. User Login: POST /api/auth/login', () => {
    it('should accept valid credentials and return a short-lived tempToken', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(registerPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tempToken');
      userTempToken = res.body.tempToken;
    });

    it('should reject login for invalid passwords', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: registerPayload.email,
          password: 'IncorrectPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid email or password.');
    });
  });

  describe('3. 2FA Verification: POST /api/auth/2fa/verify', () => {
    it('should authorize the user and return a JWT on correct TOTP code', async () => {
      // Dynamically generate the current valid 6-digit code for the user
      const code = speakeasy.totp({
        secret: savedUserSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          tempToken: userTempToken,
          code: code
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', registerPayload.email);
      expect(res.body.user).toHaveProperty('role', 'USER');
    });

    it('should reject verification with incorrect 2FA codes', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          tempToken: userTempToken,
          code: '999999'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid 2FA code. Please try again.');
    });

    it('should reject verification for incorrect tempTokens', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          tempToken: 'bad-temp-token',
          code: '123456'
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Temporary token is invalid or expired.');
    });
  });

  describe('4. Admin Login: POST /api/admin/login', () => {
    it('should authorize administrative credentials and issue a tempToken', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send(adminPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tempToken');
      adminTempToken = res.body.tempToken;
    });

    it('should prevent regular users from logging in via the admin portal', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send(registerPayload);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Admin access required.');
    });

    it('should verify admin 2FA and issue full admin session JWT', async () => {
      const code = speakeasy.totp({
        secret: savedAdminSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          tempToken: adminTempToken,
          code: code
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('role', 'ADMIN');
    });
  });
});
