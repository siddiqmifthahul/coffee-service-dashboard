import { config } from '../config.js';

export class AiUnavailableError extends Error {}

/** Panggil ai-service (FastAPI) dengan timeout. Melempar AiUnavailableError bila gagal. */
export async function callAi(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.aiTimeoutMs);
  try {
    const res = await fetch(`${config.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiUnavailableError(`AI service ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    const reason = err.name === 'AbortError' ? 'timeout' : err.message;
    throw new AiUnavailableError(`AI service tidak dapat dihubungi (${reason})`);
  } finally {
    clearTimeout(timer);
  }
}
