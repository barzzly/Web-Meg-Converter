const { githubConfig, githubRequest, json } = require('./_github');

function parseRunRequestId(run) {
  const text = `${run.display_title || ''} ${run.name || ''}`;
  return text.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]?.toLowerCase() || '';
}

function getRunIdFromRequestId(run) {
  const requestId = parseRunRequestId(run);
  return requestId ? run.id : null;
}

function normalizeStatus(run) {
  if (run.status !== 'completed') return run.status || 'queued';
  return run.conclusion || 'failure';
}

module.exports = async function status(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed.' });

  try {
    const requestId = String(req.query?.request_id || '');
    const since = String(req.query?.since || '');
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json(res, 400, { error: 'Invalid conversion request.' });

    const config = githubConfig();
    const query = new URLSearchParams({ event: 'workflow_dispatch', per_page: '20', branch: config.branch });
    if (since && !Number.isNaN(Date.parse(since))) query.set('created', `>=${new Date(since).toISOString()}`);
    const response = await githubRequest(`/repos/${config.repository}/actions/workflows/${encodeURIComponent(config.workflow)}/runs?${query}`);
    if (!response.ok) return json(res, 502, { error: 'Could not read GitHub conversion status.' });

    const payload = await response.json();
    const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
    const run = runs.find((candidate) => parseRunRequestId(candidate) === requestId.toLowerCase());
    // GitHub may expose run metadata before display_title is refreshed; only trust exact request IDs.
    if (!run || !getRunIdFromRequestId(run)) return json(res, 200, { status: 'queued', request_id: requestId });

    return json(res, 200, {
      status: run.status === 'completed' ? 'completed' : normalizeStatus(run),
      conclusion: run.conclusion,
      run_id: String(run.id),
      request_id: requestId,
      html_url: run.html_url,
    });
  } catch (error) {
    console.error('Status lookup error:', error.message);
    return json(res, 500, { error: 'Could not read conversion status.' });
  }
};
