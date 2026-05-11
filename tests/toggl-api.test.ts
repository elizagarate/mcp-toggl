import { afterEach, describe, expect, it, vi } from 'vitest';
import { TogglAPI, TogglAPIError } from '../src/toggl-api.js';

function mockResponse({
  status,
  text = '',
  json,
  retryAfter,
}: {
  status: number;
  text?: string;
  json?: unknown;
  retryAfter?: string;
}): Response {
  const headers = new Headers();
  if (retryAfter) headers.set('Retry-After', retryAfter);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    text: async () => text,
    json: async () => json,
  } as unknown as Response;
}

describe('toggl api errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses Toggl quota reset seconds from 402 responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({
        status: 402,
        text: 'You have hit your hourly limit for API calls. The quota will reset in 133 seconds.',
      })
    );

    const api = new TogglAPI('token');
    await expect(api.getWorkspaces()).rejects.toMatchObject({
      code: 'TOGGL_QUOTA_LIMIT',
      status: 402,
      retry_after_seconds: 133,
    });
    await expect(api.getWorkspaces()).rejects.toBeInstanceOf(TogglAPIError);
  });

  it('returns structured rate limit errors instead of sleeping for long retry windows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ status: 429, retryAfter: '60' })
    );

    const api = new TogglAPI('token');
    await expect(api.getWorkspaces()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retry_after_seconds: 60,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
