import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCOPES,
  GOOGLE_CHAT_CONSOLE_CONFIG_URL,
  normalizeSpaceResourceName,
  isConsumerGmailAddress,
  parseGoogleChatError,
  formatVideoShareMessage,
} from './googleChatHelper';

test('SCOPES includes core Google Chat spaces and messages scopes', () => {
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/chat.spaces'));
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/chat.messages'));
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/chat.messages.create'));
  assert.ok(SCOPES.includes('https://www.googleapis.com/auth/chat.delete'));
});

test('normalizeSpaceResourceName prefixes bare IDs with spaces/', () => {
  assert.equal(normalizeSpaceResourceName('AAAABBBB'), 'spaces/AAAABBBB');
  assert.equal(normalizeSpaceResourceName('spaces/AAAABBBB'), 'spaces/AAAABBBB');
  assert.equal(normalizeSpaceResourceName('  '), '');
});

test('isConsumerGmailAddress identifies @gmail.com vs Workspace domain', () => {
  assert.equal(isConsumerGmailAddress('user@gmail.com'), true);
  assert.equal(isConsumerGmailAddress('User@GoogleMail.com'), true);
  assert.equal(isConsumerGmailAddress('editor@studio-company.com'), false);
  assert.equal(isConsumerGmailAddress(null), false);
});

test('parseGoogleChatError detects HTTP 404 Google Chat app not found prerequisite error', () => {
  const raw404 = JSON.stringify({
    error: {
      code: 404,
      message:
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.',
      status: 'NOT_FOUND',
    },
  });

  const parsed = parseGoogleChatError(404, raw404);
  assert.equal(parsed.code, 'CHAT_APP_NOT_CONFIGURED');
  assert.equal(parsed.isPrerequisiteError, true);
  assert.ok(parsed.message.includes('Google Chat app not found'));
  assert.equal(parsed.consoleUrl, GOOGLE_CHAT_CONSOLE_CONFIG_URL);
});

test('parseGoogleChatError detects Workspace account requirement on 403', () => {
  const raw403 = JSON.stringify({
    error: {
      code: 403,
      message: 'Google Chat is not available for consumer accounts.',
    },
  });

  const parsed = parseGoogleChatError(403, raw403);
  assert.equal(parsed.code, 'WORKSPACE_ACCOUNT_REQUIRED');
  assert.equal(parsed.isPrerequisiteError, true);
});

test('formatVideoShareMessage builds structured Google Chat message text', () => {
  const msg = formatVideoShareMessage({
    title: 'Neon City Timelapse',
    platformName: 'CapCut AI Editor',
    quality: '1080p',
    filename: 'neon_city_edit.mp4',
    sourceUrl: 'https://youtube.com/shorts/abc123xyz',
    note: 'Ready for final review!',
  });

  assert.ok(msg.includes('Neon City Timelapse'));
  assert.ok(msg.includes('CapCut AI Editor'));
  assert.ok(msg.includes('neon_city_edit.mp4'));
  assert.ok(msg.includes('Ready for final review!'));
});
