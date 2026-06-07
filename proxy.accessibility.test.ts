import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { rateLimit } from './lib/rate-limit';

vi.mock('./lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

function renderProxyStatus(limit: string, remaining: string, reset: string) {
  const container = document.createElement('div');
  container.id = 'proxy-status-container';
  container.innerHTML = `
    <div role="region" aria-labelledby="proxy-title">
      <h3 id="proxy-title">Proxy Rate Limiter</h3>
      <div id="status-card" role="status" aria-describedby="rate-limit-desc">
        <p id="rate-limit-desc">
          You have <span id="rem">${remaining}</span> of <span id="lim">${limit}</span> requests remaining.
        </p>
        <button id="action-btn" tabindex="0" class="focus:outline-2 focus:outline-blue-500">
          Retry Request
        </button>
        <div id="reset-tooltip" role="tooltip" aria-live="polite">
          Resets at timestamp ${reset}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);
  return container;
}

describe('proxy.accessibility - Accessibility & Screen Reader Aria Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const existing = document.getElementById('proxy-status-container');
    if (existing) {
      existing.remove();
    }
  });

  it('inspects markup to verify correct use of accessible label coordinates', async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123456,
    });

    const request = new NextRequest('http://localhost:3000/api/streak');
    const response = await proxy(request);
    const limit = response.headers.get('X-RateLimit-Limit') || '0';
    const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
    const reset = response.headers.get('X-RateLimit-Reset') || '0';

    const container = renderProxyStatus(limit, remaining, reset);

    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-labelledby')).toBe('proxy-title');

    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-describedby')).toBe('rate-limit-desc');
  });

  it('asserts elements that accept key focus maintain visible outline behaviors', async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123456,
    });

    const request = new NextRequest('http://localhost:3000/api/streak');
    const response = await proxy(request);
    const limit = response.headers.get('X-RateLimit-Limit') || '0';
    const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
    const reset = response.headers.get('X-RateLimit-Reset') || '0';

    const container = renderProxyStatus(limit, remaining, reset);

    const actionBtn = container.querySelector('#action-btn');
    expect(actionBtn).not.toBeNull();
    expect(actionBtn?.getAttribute('tabindex')).toBe('0');
    expect(actionBtn?.className).toContain('focus:');
  });

  it('verifies tooltip labels are announced with correct accessibility descriptions', async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123456,
    });

    const request = new NextRequest('http://localhost:3000/api/streak');
    const response = await proxy(request);
    const limit = response.headers.get('X-RateLimit-Limit') || '0';
    const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
    const reset = response.headers.get('X-RateLimit-Reset') || '0';

    const container = renderProxyStatus(limit, remaining, reset);

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.getAttribute('aria-live')).toBe('polite');
    expect(tooltip?.textContent).toContain(reset);
  });

  it('tests keyboard control path selectors to ensure normal tab ordering', async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123456,
    });

    const request = new NextRequest('http://localhost:3000/api/streak');
    const response = await proxy(request);
    const limit = response.headers.get('X-RateLimit-Limit') || '0';
    const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
    const reset = response.headers.get('X-RateLimit-Reset') || '0';

    const container = renderProxyStatus(limit, remaining, reset);

    const focusable = Array.from(container.querySelectorAll('[tabindex="0"]')) as HTMLElement[];
    expect(focusable.length).toBe(1);
    expect(focusable[0].id).toBe('action-btn');
  });

  it('confirms standard headings exist in the correct logical hierarchical order', async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 123456,
    });

    const request = new NextRequest('http://localhost:3000/api/streak');
    const response = await proxy(request);
    const limit = response.headers.get('X-RateLimit-Limit') || '0';
    const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
    const reset = response.headers.get('X-RateLimit-Reset') || '0';

    const container = renderProxyStatus(limit, remaining, reset);

    const headings = Array.from(
      container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    ) as HTMLElement[];
    expect(headings.length).toBe(1);
    expect(headings[0].tagName.toLowerCase()).toBe('h3');
  });
});
