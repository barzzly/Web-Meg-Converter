const GITHUB_API = 'https://api.github.com';

function githubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository || !repository.includes('/')) {
    throw new Error('GitHub integration is not configured.');
  }
  const [owner, name] = repository.split('/');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error('GitHub repository configuration is invalid.');
  }
  return { token, repository, workflow: process.env.GITHUB_WORKFLOW || 'convert.yml', branch: process.env.GITHUB_BRANCH || 'main' };
}

async function githubRequest(path, options = {}) {
  const { token } = githubConfig();
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  return response;
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(body));
}

module.exports = { githubConfig, githubRequest, json };
