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

  const apiKey = process.env.ELEVENLABS_VOICE_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;

  if (!apiKey || !voiceId) {
    return json({ error: 'Cloud voice is not configured.' }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return json({ error: 'Cloud voice provider request failed.' }, 502);
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Cloud voice request timed out.'
      : 'Cloud voice provider is unavailable.';
    return json({ error: message }, 502);
  } finally {
    clearTimeout(timeout);
  }
};
