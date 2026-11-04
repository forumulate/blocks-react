import { describe, expect, it } from 'vitest';
import { both, doc } from './parity.js';

/** Visual parity for the API-reference blocks (`rateLimit`, `errorCodes`). */

const rl = (attrs: unknown) => ({ type: 'rateLimit', attrs });
const ec = (attrs: unknown) => ({ type: 'errorCodes', attrs });

const cases: Record<string, unknown[]> = {
  'rate limit, everything set': [
    rl({
      limit: 12000,
      window: 'minute',
      scope: 'per API key <b>',
      burst: 2500,
      headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      note: '  Retry after the Retry-After header. ',
    }),
  ],
  'rate limit, bare': [rl({ limit: 5, window: 'second' })],
  'rate limit, blank scope and note, no headers': [rl({ limit: 1, window: 'day', scope: '  ', note: '', headers: [] })],
  'rate limit, invalid': [rl({ limit: 1.5, window: 'hour' }), rl({ limit: 10, window: 'week' }), rl(undefined)],
  'error codes': [
    ec({
      title: 'Errors',
      rows: [
        { code: 'rate_limited', status: 429, description: 'Too many requests.' },
        { code: 'invalid_key', status: 401, description: 'Key is <missing> & revoked.' },
        { code: 'no.status:here' },
        { code: 'bad code!', status: 500, description: 'dropped' },
      ],
    }),
  ],
  'error codes, untitled': [ec({ rows: [{ code: 'x', description: 'one' }] })],
  'error codes, nothing valid': [ec({ title: 'Errors', rows: [{ code: '' }] }), ec({ rows: [] }), ec(undefined)],
};

describe('visual parity: API-reference blocks', () => {
  for (const [name, content] of Object.entries(cases)) {
    it(name, () => {
      const { hosted, react } = both(doc(...content));
      expect(react).toBe(hosted);
    });
  }
});
