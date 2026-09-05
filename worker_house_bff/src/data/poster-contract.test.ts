import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePoster } from '../cloudClient.js';
import {
  buildPosterPayload,
  isPublicPoster,
  normalizeAdminMiniPoster,
  validatePosterEnabledInput,
} from './poster-contract.js';

const basePoster = {
  id: 'poster-strict',
  title: '严格海报',
  coverImage: '/static/poster.jpg',
  detailImages: ['/static/poster.jpg'],
  enabled: true,
  sort: 1,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
};

test('normalizes poster enabled only from an explicit boolean', () => {
  assert.equal(normalizePoster(basePoster)?.enabled, true);
  assert.equal(normalizePoster({ ...basePoster, enabled: false })?.enabled, false);
  assert.equal(normalizePoster({ ...basePoster, enabled: 'false' }), null);
  assert.equal(normalizePoster({ ...basePoster, enabled: 1 }), null);
  const { enabled: _enabled, ...missingEnabled } = basePoster;
  assert.equal(normalizePoster(missingEnabled), null);
});

test('keeps public poster visibility fail-closed', () => {
  assert.equal(isPublicPoster({ enabled: true }), true);
  assert.equal(isPublicPoster({ enabled: false }), false);
  assert.equal(isPublicPoster({ enabled: 'true' }), false);
  assert.equal(isPublicPoster({}), false);
  assert.equal(isPublicPoster(null), false);
});

test('requires POST poster enabled and rejects malformed or contradictory state', () => {
  assert.throws(
    () => validatePosterEnabledInput({}, true),
    (error: unknown) => (error as { code?: string }).code === 'POSTER_PAYLOAD_INVALID',
  );
  assert.throws(
    () => validatePosterEnabledInput({ enabled: 'false' }, true),
    (error: unknown) => (error as { code?: string }).code === 'POSTER_PAYLOAD_INVALID',
  );
  assert.equal(validatePosterEnabledInput({ enabled: false }, true), false);

  assert.throws(
    () => buildPosterPayload({ ...basePoster, enabled: true, status: 'offline' }),
    /状态不一致/,
  );
  assert.throws(
    () => buildPosterPayload({ ...basePoster, enabled: false, status: 'draft' }),
    /online 或 offline/,
  );
});

test('admin poster reads and partial writes never default an uncertain state online', () => {
  const missingEnabled = normalizeAdminMiniPoster({
    ...basePoster,
    enabled: undefined,
    status: 'online',
  });
  assert.equal(missingEnabled.enabled, false);
  assert.equal(missingEnabled.status, 'offline');

  const stringEnabled = normalizeAdminMiniPoster({
    ...basePoster,
    enabled: 'true',
    status: 'online',
  });
  assert.equal(stringEnabled.enabled, false);

  const invalidStatus = normalizeAdminMiniPoster({
    ...basePoster,
    enabled: true,
    status: 'draft',
  });
  assert.equal(invalidStatus.enabled, false);
  assert.equal(invalidStatus.status, 'offline');

  const disabled = normalizeAdminMiniPoster({ ...basePoster, enabled: false, status: 'offline' });
  assert.equal(buildPosterPayload({ title: '只更新标题' }, disabled).enabled, false);
  assert.equal(buildPosterPayload({ status: 'online' }, disabled).enabled, true);
  assert.equal(buildPosterPayload({ enabled: true }, disabled).status, 'online');
});
