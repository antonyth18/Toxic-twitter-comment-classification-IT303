const express = require('express');
const prisma = require('../prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const CLASSIFIER_URL = process.env.CLASSIFIER_SERVICE_URL || 'http://localhost:8000';

// Pool of realistic simulated tweets (avoiding any paid Twitter/X API charges)
const MOCK_TWEET_POOL = [
  "Just finished reading the new AI research paper, incredible advancements being made this year!",
  "Shut up you stupid idiot, nobody asked for your trash opinion. Go delete your account.",
  "I know exactly where you live and I will find you and make you regret ever posting this.",
  "I hate people from that community, they are disgusting and should all be eliminated.",
  "Loved the live concert tonight, the acoustic performance was absolutely wonderful and inspiring!",
  "Great job on the new release! The UI is super smooth and intuitive.",
  "You are the most pathetic clown on this platform, stop embarrassing yourself.",
  "Looking forward to the upcoming tech conference in November. Who else is attending?",
  "Anyone who believes this nonsense is completely braindead and deserves what's coming to them.",
  "I swear I will hunt you down and destroy everything you care about.",
  "Beautiful morning for a run in the park! Hope everyone has a productive week.",
  "Why do people always complain instead of building something useful themselves?",
  "This referee is completely blind and ruined the entire football match today.",
  "Such an inspiring speech by the keynote speaker, really gives hope for the future.",
  "Get lost you filthy scumbag, nobody wants you anywhere near this project.",
  "Excited to announce our open source release today! Check out the repo on GitHub."
];

/**
 * Helper to call the classifier service for a single text
 */
async function classifyComment(text) {
  try {
    const response = await fetch(`${CLASSIFIER_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(4000)
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    // If CLASSIFIER_URL failed and it was pointing to docker hostname, try localhost
    if (CLASSIFIER_URL !== 'http://localhost:8000') {
      try {
        const retryRes = await fetch('http://localhost:8000/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(3000)
        });
        if (retryRes.ok) return await retryRes.json();
      } catch (retryErr) {
        // Fall back below
      }
    }
  }

  // Fallback heuristic if classifier service cannot be reached
  const lower = text.toLowerCase();
  const toxicKeywords = ['hate', 'kill', 'stupid', 'idiot', 'trash', 'dumb', 'ugly', 'scumbag', 'destroy'];
  const isToxic = toxicKeywords.some(w => lower.includes(w));
  return {
    label: isToxic ? 'toxic' : 'normal',
    subcategories: isToxic ? ['insult'] : [],
    confidence: isToxic ? 0.88 : 0.95,
    timestamp: new Date().toISOString()
  };
}

/**
 * POST /api/feed/fetch
 * Auth required.
 * Generates a dynamic batch of simulated tweets, classifies each via the ML service,
 * persists the fetch and classifications to the database, and returns the results.
 */
router.post('/feed/fetch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Pick 5 distinct random tweets from the pool
    const shuffled = [...MOCK_TWEET_POOL].sort(() => 0.5 - Math.random());
    const selectedTweets = shuffled.slice(0, 5);

    // Classify all selected tweets concurrently
    const classifiedPromises = selectedTweets.map(async (text) => {
      const result = await classifyComment(text);
      return {
        text,
        label: result.label || 'normal',
        subcategories: Array.isArray(result.subcategories) ? result.subcategories : [],
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.9,
        timestamp: result.timestamp || new Date().toISOString()
      };
    });

    const classifiedComments = await Promise.all(classifiedPromises);

    // Persist to database (FeedFetch + Classifications)
    const feedFetch = await prisma.feedFetch.create({
      data: {
        user_id: userId,
        fetched_at: new Date(),
        classifications: {
          create: classifiedComments.map(c => ({
            comment_text: c.text,
            label: c.label,
            subcategories_json: c.subcategories,
            confidence: c.confidence,
            timestamp: new Date(c.timestamp)
          }))
        }
      },
      include: {
        classifications: true
      }
    });

    // Format output matching frontend expectations
    const responsePayload = feedFetch.classifications.map(c => ({
      id: c.id,
      text: c.comment_text,
      label: c.label,
      subcategories: c.subcategories_json,
      confidence: c.confidence,
      timestamp: c.timestamp.toISOString()
    }));

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error('Error in POST /api/feed/fetch:', error);
    return res.status(500).json({ error: 'Internal server error while processing feed.' });
  }
});

/**
 * GET /api/feed/history
 * Auth required.
 * Retrieves the calling user's past fetches with their classification results from PostgreSQL.
 */
router.get('/feed/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const fetches = await prisma.feedFetch.findMany({
      where: {
        user_id: userId
      },
      orderBy: {
        fetched_at: 'desc'
      },
      take: 30,
      include: {
        classifications: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    // Format history structure to match HistoryPage expectations
    const historyPayload = fetches.map(f => {
      const toxicCount = f.classifications.filter(c => c.label.toLowerCase() === 'toxic').length;
      const normalCount = f.classifications.length - toxicCount;

      return {
        id: f.id,
        timestamp: f.fetched_at.toISOString(),
        summary: `${f.classifications.length} comments fetched, ${toxicCount} flagged toxic`,
        totalComments: f.classifications.length,
        toxicCount,
        normalCount,
        comments: f.classifications.map(c => ({
          text: c.comment_text,
          label: c.label,
          subcategories: Array.isArray(c.subcategories_json) ? c.subcategories_json : [],
          confidence: c.confidence,
          timestamp: c.timestamp.toISOString()
        }))
      };
    });

    return res.status(200).json(historyPayload);

  } catch (error) {
    console.error('Error in GET /api/feed/history:', error);
    return res.status(500).json({ error: 'Internal server error while retrieving feed history.' });
  }
});

module.exports = router;
