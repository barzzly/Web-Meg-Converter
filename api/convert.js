const { randomUUID } = require('crypto');
const { githubConfig, githubRequest, json } = require('./_github');

function isAllowedSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

module.exports = async function convert(req, res) {
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').json({ error: 'Method not allowed.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!isAllowedSourceUrl(body.url)) return res.status(400).json({ error: 'Invalid HTTPS ZIP download URL.' });

    const config = githubConfig();
    const requestId = randomUUID();
    const response = await githubRequest(`/repos/${config.repository}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: config.branch,
        inputs: { zip_url: body.url, request_id: requestId },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('GitHub dispatch failed:', response.status, detail.slice(0, 300));
      return json(res, 502, { error: 'GitHub could not start conversion.' });
    }

    return json(res, 202, { request_id: requestId, status: 'queued' });
  } catch (error) {
    console.error('Conversion dispatch error:', error.message);
    return json(res, 500, { error: error.message || 'Could not start conversion.' });
  }
};
