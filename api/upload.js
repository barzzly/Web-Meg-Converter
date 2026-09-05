const { handleUpload } = require('@vercel/blob/client');
const { randomUUID } = require('crypto');

const MAX_FILE_SIZE = 250 * 1024 * 1024;

function getPayload(body) {
  if (!body || typeof body !== 'object') return {};
  if (typeof body.clientPayload !== 'string') return {};
  try { return JSON.parse(body.clientPayload); } catch { return {}; }
}

module.exports = async function upload(req, res) {
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').json({ error: 'Method not allowed.' });

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const clientPayload = getPayload(rawBody);
    const filename = typeof clientPayload.filename === 'string' ? clientPayload.filename : '';
    const size = Number(clientPayload.size);
    if (!process.env.BLOBMEG_READ_WRITE_TOKEN) throw new Error('Blob storage is not configured.');

    if (!filename || !filename.toLowerCase().endsWith('.zip')) return res.status(400).json({ error: 'Only .zip files are accepted.' });
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE) return res.status(400).json({ error: 'File must be between 1 byte and 250 MB.' });

    const result = await handleUpload({
      token: process.env.BLOBMEG_READ_WRITE_TOKEN,
      request: req,
      body: rawBody,
      onBeforeGenerateToken: async (pathname, payload, multipart) => {
        const safeName = pathname.split('/').pop() || '';
        const parsedPayload = getPayload({ clientPayload: payload });
        const payloadName = parsedPayload.filename || safeName;
        const payloadSize = Number(parsedPayload.size);
        if (multipart) throw new Error('Multipart uploads are not supported.');
        if (!payloadName.toLowerCase().endsWith('.zip')) throw new Error('Only .zip files are accepted.');
        if (!Number.isSafeInteger(payloadSize) || payloadSize <= 0 || payloadSize > MAX_FILE_SIZE) throw new Error('File must be between 1 byte and 250 MB.');
        if (!safeName.toLowerCase().endsWith('.zip')) throw new Error('Only .zip files are accepted.');
        return {
          allowedContentTypes: ['application/zip'],
          maximumSizeInBytes: MAX_FILE_SIZE,
          validUntil: Date.now() + 15 * 60 * 1000,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ requestId: randomUUID() }),
        };
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Upload token error:', error.message);
    return res.status(400).json({ error: error.message || 'Could not prepare temporary upload.' });
  }
};
