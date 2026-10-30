import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  SCOPES,
  normalizeSpaceResourceName,
  parseGoogleChatError,
  ParsedGoogleChatError,
} from '../utils/googleChatHelper';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'consent',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export interface GoogleChatSpace {
  name: string;
  type?: string;
  spaceType?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | string;
  displayName?: string;
  externalUserAllowed?: boolean;
  spaceThreadingState?: string;
  spaceDetails?: {
    description?: string;
    guidelines?: string;
  };
}

export interface GoogleChatMessage {
  name: string;
  sender?: {
    name?: string;
    displayName?: string;
    email?: string;
    type?: 'HUMAN' | 'BOT' | string;
  };
  createTime?: string;
  text?: string;
  formattedText?: string;
  emojiReactionSummaries?: Array<{
    emoji?: { unicode?: string };
    reactionCount?: number;
  }>;
}

export interface GoogleChatMembership {
  name: string;
  state?: string;
  role?: 'ROLE_MEMBER' | 'ROLE_MANAGER' | string;
  member?: {
    name?: string;
    displayName?: string;
    type?: string;
  };
}

export class GoogleChatApiException extends Error {
  public details: ParsedGoogleChatError;

  constructor(details: ParsedGoogleChatError) {
    super(details.message);
    this.name = 'GoogleChatApiException';
    this.details = details;
  }
}

/**
 * Initialize Firebase Auth state listener.
 * Clears the in-memory cached token whenever the user signs out or token is absent.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Must be called from a button click or user interaction.
 */
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

async function chatApiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new GoogleChatApiException(
      parseGoogleChatError(401, 'Missing OAuth access token. Please sign in with Google.')
    );
  }

  const res = await fetch(`https://chat.googleapis.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new GoogleChatApiException(parseGoogleChatError(res.status, errText));
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/**
 * Lists Google Chat spaces the signed-in user is a member of.
 */
export async function listChatSpaces(): Promise<GoogleChatSpace[]> {
  const data = await chatApiRequest<{ spaces?: GoogleChatSpace[] }>(
    'spaces?pageSize=50'
  );
  return data.spaces || [];
}

/**
 * Creates a new Google Chat space.
 */
export async function createChatSpace(
  displayName: string,
  description?: string,
  externalUserAllowed = false
): Promise<GoogleChatSpace> {
  const body: Record<string, any> = {
    spaceType: 'SPACE',
    displayName: displayName.trim(),
    externalUserAllowed,
  };
  if (description && description.trim()) {
    body.spaceDetails = {
      description: description.trim(),
    };
  }
  return chatApiRequest<GoogleChatSpace>('spaces', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Deletes a Google Chat space.
 */
export async function deleteChatSpace(spaceName: string): Promise<void> {
  const normalized = normalizeSpaceResourceName(spaceName);
  await chatApiRequest<Record<string, never>>(normalized, {
    method: 'DELETE',
  });
}

/**
 * Lists recent messages in a Google Chat space.
 */
export async function listSpaceMessages(
  spaceName: string
): Promise<GoogleChatMessage[]> {
  const normalized = normalizeSpaceResourceName(spaceName);
  const data = await chatApiRequest<{ messages?: GoogleChatMessage[] }>(
    `${normalized}/messages?pageSize=30&orderBy=createTime%20desc`
  );
  // Reverse so chronological order is oldest -> newest in chat feed
  return (data.messages || []).slice().reverse();
}

/**
 * Lists members in a Google Chat space.
 */
export async function listSpaceMembers(
  spaceName: string
): Promise<GoogleChatMembership[]> {
  const normalized = normalizeSpaceResourceName(spaceName);
  const data = await chatApiRequest<{ memberships?: GoogleChatMembership[] }>(
    `${normalized}/members?pageSize=30`
  );
  return data.memberships || [];
}

/**
 * Sends a text message to a Google Chat space.
 */
export async function sendChatMessage(
  spaceName: string,
  text: string
): Promise<GoogleChatMessage> {
  const normalized = normalizeSpaceResourceName(spaceName);
  return chatApiRequest<GoogleChatMessage>(`${normalized}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text: text.trim() }),
  });
}

/**
 * Updates an existing Google Chat message.
 */
export async function updateChatMessage(
  messageName: string,
  text: string
): Promise<GoogleChatMessage> {
  return chatApiRequest<GoogleChatMessage>(
    `${messageName}?updateMask=text`,
    {
      method: 'PATCH',
      body: JSON.stringify({ text: text.trim() }),
    }
  );
}

/**
 * Deletes a Google Chat message.
 */
export async function deleteChatMessage(messageName: string): Promise<void> {
  await chatApiRequest<Record<string, never>>(messageName, {
    method: 'DELETE',
  });
}

/**
 * Adds a unicode emoji reaction to a Google Chat message.
 */
export async function addMessageReaction(
  messageName: string,
  unicodeEmoji: string
): Promise<void> {
  await chatApiRequest(`${messageName}/reactions`, {
    method: 'POST',
    body: JSON.stringify({
      emoji: { unicode: unicodeEmoji },
    }),
  });
}
