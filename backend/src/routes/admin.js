const express = require('express');
const prisma = require('../prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/logs
 * Retrieve system activity logs. Admin only. Supports filtering and pagination.
 */
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  const { user, date, action, page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  // Filter by actor_id (exact match or username/email string)
  if (user) {
    where.actor_id = {
      contains: user,
      mode: 'insensitive'
    };
  }

  // Filter by action_type
  if (action) {
    where.action_type = {
      contains: action,
      mode: 'insensitive'
    };
  }

  // Filter by matching date day (starts at 00:00:00 to 23:59:59)
  if (date) {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      const startOfDay = new Date(parsedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(parsedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      where.timestamp = {
        gte: startOfDay,
        lte: endOfDay
      };
    } else {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
  }

  try {
    const logs = await prisma.activityLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { timestamp: 'desc' }
    });

    const total = await prisma.activityLog.count({ where });

    return res.status(200).json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error while fetching logs.' });
  }
});

module.exports = router;
