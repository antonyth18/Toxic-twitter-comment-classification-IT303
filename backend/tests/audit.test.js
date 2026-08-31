const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/prisma');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');

describe('Audit Logging System Integration Tests', () => {
  const testUser = {
    email: 'audit_user@test.com',
    password: 'Password123!'
  };

  const testAdmin = {
    email: 'audit_admin@test.com',
    password: 'AdminPassword123!'
  };

  let userToken = '';
  let adminToken = '';
  let userId = '';
  let adminId = '';

  beforeAll(async () => {
    // Clear test records
    await prisma.user.deleteMany({
      where: {
        email: { in: [testUser.email, testAdmin.email] }
      }
    });
    
    // Clear logs originating from the test emails/ids
    await prisma.activityLog.deleteMany({
      where: {
        actor_id: { in: [testUser.email, testAdmin.email] }
      }
    });

    const bcrypt = require('bcryptjs');
    const userHashed = await bcrypt.hash(testUser.password, 10);
    const adminHashed = await bcrypt.hash(testAdmin.password, 10);

    const userSecret = speakeasy.generateSecret();
    const adminSecret = speakeasy.generateSecret();

    // Create user
    const dbUser = await prisma.user.create({
      data: {
        email: testUser.email,
        password_hash: userHashed,
        role: 'USER',
        status: 'active',
        totp_secret: userSecret.base32
      }
    });
    userId = dbUser.id;

    // Create admin
    const dbAdmin = await prisma.user.create({
      data: {
        email: testAdmin.email,
        password_hash: adminHashed,
        role: 'ADMIN',
        status: 'active',
        totp_secret: adminSecret.base32
      }
    });
    adminId = dbAdmin.id;

    // Get tokens for testing protected routes
    const userJWT = jwt.sign({ userId: dbUser.id, role: 'USER' }, process.env.JWT_SECRET || 'super_secret_jwt_key_123!', { expiresIn: '1h' });
    const adminJWT = jwt.sign({ userId: dbAdmin.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'super_secret_jwt_key_123!', { expiresIn: '1h' });

    userToken = `Bearer ${userJWT}`;
    adminToken = `Bearer ${adminJWT}`;
  });

  afterAll(async () => {
    // Delete test logs and users
    await prisma.activityLog.deleteMany({
      where: {
        actor_id: { in: [testUser.email, testAdmin.email, userId, adminId, 'anonymous'] }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: [testUser.email, testAdmin.email] }
      }
    });
    await prisma.$disconnect();
  });

  it('1. should create an audit log on a failed login attempt', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'IncorrectPassword'
      });

    expect(res.status).toBe(401);

    // Fetch the generated log
    const log = await prisma.activityLog.findFirst({
      where: {
        actor_id: testUser.email,
        action_type: 'POST_API_AUTH_LOGIN'
      },
      orderBy: { timestamp: 'desc' }
    });

    expect(log).toBeDefined();
    expect(log.actor_type).toBe('GUEST');
    expect(log.details_json.outcome).toBe('failure');
    // Ensure password is redacted
    expect(log.details_json.requestBody.password).toBe('[REDACTED]');
  });

  it('2. should create an audit log on a successful credentials login step', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(testUser);

    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirst({
      where: {
        actor_id: testUser.email,
        action_type: 'POST_API_AUTH_LOGIN'
      },
      orderBy: { timestamp: 'desc' }
    });

    expect(log).toBeDefined();
    expect(log.details_json.outcome).toBe('success');
    expect(log.details_json.responseBody.tempToken).toBe('[REDACTED]');
  });

  it('3. should create an audit log on a feed fetch attempt (protected route)', async () => {
    const res = await request(app)
      .post('/api/feed/fetch')
      .set('Authorization', userToken)
      .send({ query: 'twitter' });

    expect(res.status).toBe(501); // 501 Not Implemented placeholder

    const log = await prisma.activityLog.findFirst({
      where: {
        actor_id: userId,
        action_type: 'POST_API_FEED_FETCH'
      },
      orderBy: { timestamp: 'desc' }
    });

    expect(log).toBeDefined();
    expect(log.actor_type).toBe('USER');
    expect(log.details_json.outcome).toBe('failure'); // 501 counts as failure outcome (>= 400)
  });

  it('4. should create an audit log on an admin action (fetching logs)', async () => {
    const res = await request(app)
      .get('/api/logs')
      .set('Authorization', adminToken);

    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirst({
      where: {
        actor_id: adminId,
        action_type: 'GET_API_LOGS'
      },
      orderBy: { timestamp: 'desc' }
    });

    expect(log).toBeDefined();
    expect(log.actor_type).toBe('ADMIN');
    expect(log.details_json.outcome).toBe('success');
  });

  it('5. should fail closed and return 500 if the audit log database write fails', async () => {
    // Spy and reject database write
    const prismaCreateSpy = jest.spyOn(prisma.activityLog, 'create');
    prismaCreateSpy.mockRejectedValueOnce(new Error('Prisma database connection lost'));

    const res = await request(app)
      .post('/api/auth/login')
      .send(testUser);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Audit log write failed. Transaction aborted for security compliance.');

    prismaCreateSpy.mockRestore();
  });
});
