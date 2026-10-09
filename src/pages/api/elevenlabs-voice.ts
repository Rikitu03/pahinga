import type { APIRoute } from 'astro';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 5000;

function json(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return json({ error: 'Expected a JSON request.' }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const text = typeof body === 'object' && body !== null && 'text' in body
    ? (body as { text?: unknown }).text
    : null;

  if (typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_TEXT_LENGTH) {
    return json({ error: 'Voice text must be between 1 and 5000 characters.' }, 400);
  }

  const apiKey = (import.meta.env.ELEVENLABS_VOICE_KEY || process.env.ELEVENLABS_VOICE_KEY)?.trim();
  const voiceId = (import.meta.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID)?.trim();
  const modelId = (import.meta.env.ELEVENLABS_MODEL_ID || process.env.ELEVENLABS_MODEL_ID)?.trim() || DEFAULT_MODEL_ID;

  if (!apiKey || !voiceId) {
    return json({ error: 'Cloud voice is not configured.' }, 503);
  }

  const MAX_RETRIES = 1; // 1 retry attempt for transient failures (429, 5xx, or timeouts)
  let lastStatus = 502;
  let lastErrorMessage = 'Cloud voice provider request failed.';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(600 * attempt);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}`, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            use_speaker_boost: true
          }
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        return new Response(await response.arrayBuffer(), {
          status: 200,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      if (response.status === 429) {
        lastStatus = 429;
        lastErrorMessage = 'Cloud voice rate limit exceeded.';
        continue;
      }

      if (response.status >= 500) {
        lastStatus = 502;
        lastErrorMessage = 'Cloud voice provider service error.';
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        return json({ error: 'Cloud voice authentication failed.' }, 502);
      }
      return json({ error: `Cloud voice request failed (${response.status}).` }, 502);
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      lastStatus = isTimeout ? 504 : 502;
      lastErrorMessage = isTimeout ? 'Cloud voice request timed out.' : 'Cloud voice provider is unreachable.';
    } finally {
      clearTimeout(timeout);
    }
  }

  return json({ error: lastErrorMessage }, lastStatus);
};
