const request = require('supertest');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

const mockUser = {
  id: 'test-user-uuid-1234',
  email: 'tester@example.com',
  role: 'USER',
  status: 'active'
};

jest.mock('../src/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn()
  },
  feedFetch: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  classification: {
    create: jest.fn()
  },
  activityLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-123' }),
    findFirst: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 })
  },
  $disconnect: jest.fn().mockResolvedValue(),
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }])
}));

const prisma = require('../src/prisma');
const app = require('../src/index');

describe('POST /api/feed/classify & Audit Logging', () => {
  const userToken = `Bearer ${jwt.sign(
    { userId: mockUser.id, role: 'USER' },
    JWT_SECRET,
    { expiresIn: '1h' }
  )}`;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.activityLog.create.mockResolvedValue({ id: 'log-uuid-123' });
    prisma.feedFetch.create.mockImplementation((args) => {
      const classInput = args.data.classifications.create[0];
      return Promise.resolve({
        id: 'mock-fetch-id',
        user_id: args.data.user_id,
        fetched_at: args.data.fetched_at,
        classifications: [
          {
            id: 'mock-classification-id',
            fetch_id: 'mock-fetch-id',
            comment_text: classInput.comment_text,
            label: classInput.label,
            subcategories_json: classInput.subcategories_json,
            confidence: classInput.confidence,
            timestamp: classInput.timestamp
          }
        ]
      });
    });
  });

  it('should require authentication token (returns 401 if missing)', async () => {
    const res = await request(app)
      .post('/api/feed/classify')
      .send({ text: 'Hello world' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Access token required.');
  });

  it('should return 400 for empty or whitespace-only text', async () => {
    const res = await request(app)
      .post('/api/feed/classify')
      .set('Authorization', userToken)
      .send({ text: '     ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be empty/i);

    // Confirms an audit log row is written for the request
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'POST_API_FEED_CLASSIFY',
          actor_id: mockUser.id,
          actor_type: 'USER',
          details_json: expect.objectContaining({
            statusCode: 400,
            outcome: 'failure'
          })
        })
      })
    );
  });

  it('should return 400 for oversized text (> 1000 characters)', async () => {
    const oversizedText = 'x'.repeat(1001);
    const res = await request(app)
      .post('/api/feed/classify')
      .set('Authorization', userToken)
      .send({ text: oversizedText });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceed 1000 characters/i);

    // Confirms an audit log row is written for the request
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'POST_API_FEED_CLASSIFY',
          actor_id: mockUser.id,
          actor_type: 'USER',
          details_json: expect.objectContaining({
            statusCode: 400,
            outcome: 'failure'
          })
        })
      })
    );
  });

  it('should return 400 if text is not a string', async () => {
    const res = await request(app)
      .post('/api/feed/classify')
      .set('Authorization', userToken)
      .send({ text: 99999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be a string/i);
  });

  it('should successfully classify text, save FeedFetch with ONE classification, return expected shape, and write audit log', async () => {
    const textToClassify = 'This is a fantastic open source project!';

    const res = await request(app)
      .post('/api/feed/classify')
      .set('Authorization', userToken)
      .send({ text: `   ${textToClassify}   ` }); // with whitespace to verify trimming

    expect(res.status).toBe(200);

    // Verify return shape matches items returned by /feed/fetch:
    // {id, text, label, subcategories, confidence, timestamp}
    expect(res.body).toEqual(
      expect.objectContaining({
        id: 'mock-classification-id',
        text: textToClassify,
        label: expect.any(String),
        subcategories: expect.any(Array),
        confidence: expect.any(Number),
        timestamp: expect.any(String)
      })
    );

    // Verify FeedFetch created for user with ONE classification
    expect(prisma.feedFetch.create).toHaveBeenCalledTimes(1);
    const createCall = prisma.feedFetch.create.mock.calls[0][0];
    expect(createCall.data.user_id).toBe(mockUser.id);
    expect(createCall.data.classifications.create).toHaveLength(1);
    expect(createCall.data.classifications.create[0].comment_text).toBe(textToClassify);

    // Verify audit log row was written
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'POST_API_FEED_CLASSIFY',
          actor_id: mockUser.id,
          actor_type: 'USER',
          details_json: expect.objectContaining({
            path: '/feed/classify',
            method: 'POST',
            statusCode: 200,
            outcome: 'success',
            requestBody: expect.objectContaining({
              text: `   ${textToClassify}   `
            })
          })
        })
      })
    );
  });

  it('should correctly classify toxic comment via keyword fallback when ML service is offline', async () => {
    const toxicText = 'Shut up you stupid idiot';

    const res = await request(app)
      .post('/api/feed/classify')
      .set('Authorization', userToken)
      .send({ text: toxicText });

    expect(res.status).toBe(200);
    expect(res.body.label).toBe('toxic');
    expect(res.body.subcategories).toContain('insult');
    expect(res.body.confidence).toBeGreaterThan(0.5);
  });
});
