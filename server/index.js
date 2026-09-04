require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { init: initDb } = require('./db');
const { runDailyPipeline } = require('./services/pipeline');
const authRouter = require('./routes/auth');
const prospectsRouter = require('./routes/prospects');
const companiesRouter = require('./routes/companies');
const webhooksRouter = require('./routes/webhooks');
const clayRouter = require('./routes/clay');
const apolloRouter = require('./routes/apollo');
const apolloWebhookRouter = require('./routes/apolloWebhook');
const hubspotRouter = require('./routes/hubspot');
const instantlyRouter = require('./routes/instantly');
const pipelineRouter = require('./routes/pipeline');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const API_KEY    = process.env.API_KEY;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
}));
app.use(express.json());

// Public — login endpoint
app.use('/api/auth', authRouter);

// Public — Apollo's async phone-reveal callback. Not under /api: Apollo can't send our
// X-API-Key/JWT, so it's authenticated via a shared-secret token in the URL instead.
app.use('/webhooks', apolloWebhookRouter);

// Auth middleware — accepts JWT (dashboard) or API key (external tools)
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (API_KEY && apiKey === API_KEY) return next();

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
});

app.use('/api/prospects', prospectsRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/clay', clayRouter);
app.use('/api/apollo', apolloRouter);
app.use('/api/hubspot', hubspotRouter);
app.use('/api/instantly', instantlyRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/activity', activityRouter);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.response?.status && err.response.status < 500 ? err.response.status : 500;
  res.status(status).json({ message: err.response?.data?.message || err.message || 'Internal server error.' });
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function runScheduledPipeline() {
  runDailyPipeline()
    .then((result) => console.log('Daily pipeline:', JSON.stringify(result)))
    .catch((err) => console.error('Daily pipeline failed:', err.message));
}

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    // Sources ~10 new companies/day and pushes them through enrichment, scoring,
    // contact-finding, and HubSpot sync -- runs once shortly after boot, then daily.
    setTimeout(runScheduledPipeline, 60 * 1000);
    setInterval(runScheduledPipeline, ONE_DAY_MS);
  })
  .catch((err) => {
    console.error('DB init failed:', err.message);
    process.exit(1);
  });
