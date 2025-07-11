const express = require('express');
const router = express.Router();
const shortid = require('nanoid');
const Url = require('../models/Url');

router.post('/shorten', async (req, res) => {
  const { longUrl, customAlias, expiresAt } = req.body;

  try {
    let shortCode = customAlias || shortid.nanoid(6);

    if (customAlias) {
      const existing = await Url.findOne({ customAlias });
      if (existing) return res.status(400).json({ error: 'Custom alias already in use' });
    }

    const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;

    const url = new Url({
      longUrl,
      shortUrl,
      customAlias: customAlias || null,
      expiresAt: expiresAt || null
    });

    await url.save();
    res.json(url);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:code', async (req, res) => {
  const { code } = req.params;

  const url = await Url.findOne({
    $or: [{ customAlias: code }, { shortUrl: { $regex: code + '$' } }]
  });

  if (!url) return res.status(404).json({ error: 'URL not found' });

  if (url.expiresAt && new Date() > url.expiresAt) {
    return res.status(410).json({ error: 'URL expired' });
  }

  url.clicks += 1;
  await url.save();
  res.redirect(url.longUrl);
});

router.get('/stats/:code', async (req, res) => {
  const { code } = req.params;

  const url = await Url.findOne({
    $or: [{ customAlias: code }, { shortUrl: { $regex: code + '$' } }]
  });

  if (!url) return res.status(404).json({ error: 'URL not found' });

  res.json({
    longUrl: url.longUrl,
    shortUrl: url.shortUrl,
    clicks: url.clicks,
    createdAt: url.createdAt,
    expiresAt: url.expiresAt
  });
});

router.delete('/:code', async (req, res) => {
  const { code } = req.params;
  const result = await Url.deleteOne({
    $or: [{ customAlias: code }, { shortUrl: { $regex: code + '$' } }]
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'URL not found' });
  }

  res.json({ message: 'URL deleted successfully' });
});

module.exports = router;