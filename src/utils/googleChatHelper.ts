/**
 * Pure helper utilities and scope definitions for Google Chat Workspace integration.
 */

export const GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0060842975';

export const GOOGLE_CHAT_CONSOLE_CONFIG_URL = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${GOOGLE_CLOUD_PROJECT_ID}`;

/**
 * Configured Google Chat OAuth scopes for the applet.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/chat.admin.delete',
  'https://www.googleapis.com/auth/chat.admin.memberships',
  'https://www.googleapis.com/auth/chat.admin.memberships.readonly',
  'https://www.googleapis.com/auth/chat.admin.spaces',
  'https://www.googleapis.com/auth/chat.admin.spaces.readonly',
  'https://www.googleapis.com/auth/chat.customemojis',
  'https://www.googleapis.com/auth/chat.customemojis.readonly',
  'https://www.googleapis.com/auth/chat.delete',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.app',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.reactions',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  'https://www.googleapis.com/auth/chat.messages.reactions.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate',
  'https://www.googleapis.com/auth/chat.users.readstate.readonly',
  'https://www.googleapis.com/auth/chat.users.sections',
  'https://www.googleapis.com/auth/chat.users.sections.readonly',
  'https://www.googleapis.com/auth/chat.users.spacesettings',
];

export type GoogleChatErrorCode =
  | 'CHAT_APP_NOT_CONFIGURED'
  | 'WORKSPACE_ACCOUNT_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'API_ERROR';

export interface ParsedGoogleChatError {
  status: number;
  code: GoogleChatErrorCode;
  title: string;
  message: string;
  rawMessage: string;
  consoleUrl: string;
  isPrerequisiteError: boolean;
}

/**
 * Normalizes a Google Chat space ID or resource name to `spaces/{id}`.
 */
export function normalizeSpaceResourceName(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('spaces/')) {
    return trimmed;
  }
  return `spaces/${trimmed}`;
}

/**
 * Checks whether an email address belongs to a consumer Gmail account
 * rather than a Google Workspace custom domain.
 */
export function isConsumerGmailAddress(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith('@gmail.com') || normalized.endsWith('@googlemail.com');
}

/**
 * Parses Google Chat REST API HTTP error responses into actionable UI diagnostics,
 * specifically surfacing the HTTP 404 "Google Chat app not found" configuration step
 * and Google Workspace account requirements.
 */
export function parseGoogleChatError(
  status: number,
  responseText: string
): ParsedGoogleChatError {
  let extractedMessage = responseText?.trim() || `HTTP ${status} error`;

  try {
    const parsed = JSON.parse(responseText);
    if (parsed?.error?.message) {
      extractedMessage = String(parsed.error.message);
    }
  } catch {
    // Keep raw text if not JSON
  }

  const lower = extractedMessage.toLowerCase();

  // Detect HTTP 404 unconfigured Chat App error
  if (
    status === 404 &&
    (lower.includes('google chat app not found') ||
      lower.includes('configure the app in the google cloud console') ||
      lower.includes('turn on the chat api'))
  ) {
    return {
      status,
      code: 'CHAT_APP_NOT_CONFIGURED',
      title: 'Google Chat App Configuration Required (HTTP 404)',
      message:
        'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.',
      rawMessage: extractedMessage,
      consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
      isPrerequisiteError: true,
    };
  }

  // Detect consumer @gmail.com / non-Workspace account errors
  if (
    lower.includes('workspace') ||
    lower.includes('g suite') ||
    lower.includes('domain user') ||
    lower.includes('not available for consumer') ||
    lower.includes('chat is not enabled') ||
    (status === 403 && lower.includes('permission'))
  ) {
    return {
      status,
      code: 'WORKSPACE_ACCOUNT_REQUIRED',
      title: 'Google Workspace Business / Enterprise Account Required',
      message: `${extractedMessage} — Note: Calling the Google Chat API with user authentication requires a Business or Enterprise Google Workspace account with access to Google Chat (consumer @gmail.com accounts are not supported).`,
      rawMessage: extractedMessage,
      consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
      isPrerequisiteError: true,
    };
  }

  if (status === 401) {
    return {
      status,
      code: 'AUTH_EXPIRED',
      title: 'Google Chat Session Expired',
      message: 'Your Google OAuth access token expired or is missing. Please sign in with Google again.',
      rawMessage: extractedMessage,
      consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
      isPrerequisiteError: false,
    };
  }

  return {
    status,
    code: 'API_ERROR',
    title: `Google Chat API Error (HTTP ${status})`,
    message: extractedMessage,
    rawMessage: extractedMessage,
    consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
    isPrerequisiteError: false,
  };
}

export interface ShareableVideoSummary {
  title: string;
  platformName: string;
  quality: string;
  filename: string;
  sourceUrl?: string;
  note?: string;
}

/**
 * Formats a clean, structured Google Chat message for sharing a downloaded,
 * AI-merged, or CapCut-edited video with a team space.
 */
export function formatVideoShareMessage(video: ShareableVideoSummary): string {
  const lines: string[] = [
    `🎬 *ReelGrab Video Ready: ${video.title}*`,
    `• *Source / Studio*: ${video.platformName}`,
    `• *Format*: ${video.quality} MP4 (H.264 + AAC)`,
    `• *Filename*: \`${video.filename}\``,
  ];

  if (video.sourceUrl && video.sourceUrl.startsWith('http')) {
    lines.push(`• *Original Link*: ${video.sourceUrl}`);
  }

  if (video.note && video.note.trim()) {
    lines.push(`\n💬 *Editor Note*: ${video.note.trim()}`);
  }

  return lines.join('\n');
}
