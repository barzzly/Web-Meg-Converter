const AdmZip = require('adm-zip');
const { githubConfig, githubRequest, json } = require('./_github');

module.exports = async function download(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed.' });

  try {
    const runId = String(req.query?.run_id || '');
    if (!/^\d+$/.test(runId)) return json(res, 400, { error: 'Invalid conversion run.' });

    const config = githubConfig();
    const response = await githubRequest(`/repos/${config.repository}/actions/runs/${runId}/artifacts`);
    if (!response.ok) return json(res, 502, { error: 'Could not find conversion artifact.' });
    const payload = await response.json();
    const artifact = payload.artifacts?.find((item) => item.name === 'Bedrock-GeyserMC-Output');
    if (!artifact || artifact.expired) return json(res, 404, { error: 'Conversion artifact is unavailable.' });

    const archiveResponse = await githubRequest(`/repos/${config.repository}/actions/artifacts/${artifact.id}/zip`);
    if (!archiveResponse.ok) return json(res, 502, { error: 'Could not download conversion artifact.' });
    const archive = Buffer.from(await archiveResponse.arrayBuffer());
    const zip = new AdmZip(archive);
    const output = zip.getEntry('meg-bedrock.zip');
    if (!output) return json(res, 404, { error: 'Converted ZIP was not found in artifact.' });

    const outputBuffer = output.getData();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', outputBuffer.length);
    res.setHeader('Content-Disposition', 'attachment; filename="meg-bedrock.zip"');
    return res.end(outputBuffer);
  } catch (error) {
    console.error('Artifact download error:', error.message);
    return json(res, 500, { error: 'Could not prepare converted download.' });
  }
};
