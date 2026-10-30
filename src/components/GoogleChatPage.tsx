import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  listChatSpaces,
  createChatSpace,
  deleteChatSpace,
  listSpaceMessages,
  listSpaceMembers,
  sendChatMessage,
  updateChatMessage,
  deleteChatMessage,
  addMessageReaction,
  GoogleChatSpace,
  GoogleChatMessage,
  GoogleChatMembership,
  GoogleChatApiException,
} from '../services/googleChatService';
import {
  GOOGLE_CLOUD_PROJECT_ID,
  GOOGLE_CHAT_CONSOLE_CONFIG_URL,
  isConsumerGmailAddress,
  formatVideoShareMessage,
  ParsedGoogleChatError,
} from '../utils/googleChatHelper';
import { DownloadedVideoRecord } from './ReelGrabPlayer';
import { ParsedVideoInfo } from '../utils/urlParser';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Edit3,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Users,
  Film,
  LogOut,
  ShieldAlert,
  Info,
  Loader2,
  Hash,
  SmilePlus,
  X,
} from 'lucide-react';

interface GoogleChatPageProps {
  recentDownloads: DownloadedVideoRecord[];
  currentVideoInfo: ParsedVideoInfo;
}

interface PendingMutationConfirmation {
  type:
    | 'send_message'
    | 'create_space'
    | 'delete_space'
    | 'update_message'
    | 'delete_message'
    | 'add_reaction';
  title: string;
  description: string;
  detailsLabel: string;
  detailsValue: string;
  confirmButtonText: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void>;
}

const QUICK_REACTIONS = ['👍', '🔥', '🎬', '✅'];

export const GoogleChatPage: React.FC<GoogleChatPageProps> = ({
  recentDownloads,
  currentVideoInfo,
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Spaces & selection state
  const [spaces, setSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<GoogleChatSpace | null>(null);
  const [manualSpaceId, setManualSpaceId] = useState<string>('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState<boolean>(false);

  // Messages & memberships state
  const [messages, setMessages] = useState<GoogleChatMessage[]>([]);
  const [members, setMembers] = useState<GoogleChatMembership[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Create space form state
  const [showCreateSpaceForm, setShowCreateSpaceForm] = useState<boolean>(false);
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [newSpaceDescription, setNewSpaceDescription] = useState<string>('');
  const [allowExternalMembers, setAllowExternalMembers] = useState<boolean>(false);

  // Compose & edit message state
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [shareNote, setShareNote] = useState<string>('');
  const [editingMessageName, setEditingMessageName] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');

  // Status, errors, and mandatory confirmation dialog
  const [apiError, setApiError] = useState<ParsedGoogleChatError | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingMutationConfirmation | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleApiFailure = (err: unknown) => {
    if (err instanceof GoogleChatApiException) {
      setApiError(err.details);
      if (err.details.code === 'AUTH_EXPIRED') {
        setNeedsAuth(true);
      }
      return;
    }
    const fallbackMessage =
      err instanceof Error ? err.message : 'Unexpected Google Chat API error.';
    setApiError({
      status: 500,
      code: 'API_ERROR',
      title: 'Google Chat Operation Failed',
      message: fallbackMessage,
      rawMessage: fallbackMessage,
      consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
      isPrerequisiteError: false,
    });
  };

  const fetchSpaces = async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingSpaces(true);
    setApiError(null);
    try {
      const list = await listChatSpaces();
      setSpaces(list);
      if (list.length > 0 && !selectedSpace) {
        setSelectedSpace(list[0]);
      }
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  const fetchMessagesAndMembers = async (spaceName: string) => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingMessages(true);
    setApiError(null);
    try {
      const [msgList, memberList] = await Promise.all([
        listSpaceMessages(spaceName),
        listSpaceMembers(spaceName).catch(() => []),
      ]);
      setMessages(msgList);
      setMembers(memberList);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && user) {
      fetchSpaces();
    }
  }, [needsAuth, user]);

  useEffect(() => {
    if (!needsAuth && selectedSpace?.name) {
      fetchMessagesAndMembers(selectedSpace.name);
    }
  }, [needsAuth, selectedSpace?.name]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setApiError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        setStatusBanner(
          `Signed in as ${result.user.displayName || result.user.email || 'Google User'}`
        );
      }
    } catch (err: any) {
      setApiError({
        status: 400,
        code: 'API_ERROR',
        title: 'Google Sign-In Cancelled or Failed',
        message:
          err?.message ||
          'Could not complete Google Sign-In popup. Ensure popups are allowed in your browser.',
        rawMessage: String(err?.message || err),
        consoleUrl: GOOGLE_CHAT_CONSOLE_CONFIG_URL,
        isPrerequisiteError: false,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setSpaces([]);
    setSelectedSpace(null);
    setMessages([]);
    setMembers([]);
    setApiError(null);
    setStatusBanner(null);
  };

  const handlePrefillVideoShare = (video: {
    title: string;
    platformName: string;
    quality: string;
    filename: string;
    sourceUrl?: string;
  }) => {
    const formatted = formatVideoShareMessage({
      ...video,
      note: shareNote,
    });
    setMessageDraft(formatted);
    setStatusBanner(`Loaded "${video.title}" into the Google Chat message composer.`);
  };

  // Request confirmation before creating a Google Chat space
  const requestCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newSpaceName.trim();
    if (!trimmedName) return;

    setPendingConfirmation({
      type: 'create_space',
      title: 'Confirm Create Google Chat Space',
      description:
        'You are about to create a new Google Chat Space in your Google Workspace organization on your behalf.',
      detailsLabel: 'New Space Display Name',
      detailsValue: `${trimmedName}${
        newSpaceDescription.trim() ? ` — "${newSpaceDescription.trim()}"` : ''
      }`,
      confirmButtonText: 'Create Space in Google Chat',
      isDestructive: false,
      onConfirm: async () => {
        const created = await createChatSpace(
          trimmedName,
          newSpaceDescription,
          allowExternalMembers
        );
        setSpaces((prev) => [created, ...prev]);
        setSelectedSpace(created);
        setNewSpaceName('');
        setNewSpaceDescription('');
        setShowCreateSpaceForm(false);
        setStatusBanner(
          `Created Google Chat Space "${created.displayName || created.name}".`
        );
      },
    });
  };

  // Request confirmation before deleting a Google Chat space
  const requestDeleteSpace = (space: GoogleChatSpace) => {
    setPendingConfirmation({
      type: 'delete_space',
      title: 'Confirm Delete Google Chat Space',
      description:
        'Are you sure you want to permanently delete this Google Chat Space and all of its messages? This action cannot be undone.',
      detailsLabel: 'Space to Delete',
      detailsValue: `${space.displayName || 'Unnamed Space'} (${space.name})`,
      confirmButtonText: 'Delete Space Permanently',
      isDestructive: true,
      onConfirm: async () => {
        await deleteChatSpace(space.name);
        setSpaces((prev) => prev.filter((s) => s.name !== space.name));
        if (selectedSpace?.name === space.name) {
          setSelectedSpace(null);
          setMessages([]);
          setMembers([]);
        }
        setStatusBanner(
          `Deleted Google Chat Space "${space.displayName || space.name}".`
        );
      },
    });
  };

  // Request confirmation before sending a chat message
  const requestSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace || !messageDraft.trim()) return;
    const textToSend = messageDraft.trim();
    const targetSpace = selectedSpace;

    setPendingConfirmation({
      type: 'send_message',
      title: 'Confirm Send Google Chat Message',
      description: `This will post a message on your behalf to "${
        targetSpace.displayName || targetSpace.name
      }".`,
      detailsLabel: `Message to ${targetSpace.displayName || targetSpace.name}`,
      detailsValue: textToSend,
      confirmButtonText: 'Send Message',
      isDestructive: false,
      onConfirm: async () => {
        const createdMsg = await sendChatMessage(targetSpace.name, textToSend);
        setMessages((prev) => [...prev, createdMsg]);
        setMessageDraft('');
        setStatusBanner(
          `Message posted to ${targetSpace.displayName || targetSpace.name}.`
        );
      },
    });
  };

  // Request confirmation before updating an existing chat message
  const requestUpdateMessage = (messageName: string) => {
    const updatedText = editingMessageText.trim();
    if (!updatedText) return;

    setPendingConfirmation({
      type: 'update_message',
      title: 'Confirm Update Google Chat Message',
      description:
        'This will overwrite the text of your existing message in Google Chat.',
      detailsLabel: `Updated Message (${messageName})`,
      detailsValue: updatedText,
      confirmButtonText: 'Update Message',
      isDestructive: false,
      onConfirm: async () => {
        const updated = await updateChatMessage(messageName, updatedText);
        setMessages((prev) =>
          prev.map((m) => (m.name === messageName ? { ...m, ...updated } : m))
        );
        setEditingMessageName(null);
        setEditingMessageText('');
        setStatusBanner('Updated message in Google Chat.');
      },
    });
  };

  // Request confirmation before deleting a chat message
  const requestDeleteMessage = (msg: GoogleChatMessage) => {
    setPendingConfirmation({
      type: 'delete_message',
      title: 'Confirm Delete Google Chat Message',
      description:
        'Are you sure you want to permanently delete this message from Google Chat? This action cannot be undone.',
      detailsLabel: `Message (${msg.name})`,
      detailsValue: msg.text || '(No text content)',
      confirmButtonText: 'Delete Message',
      isDestructive: true,
      onConfirm: async () => {
        await deleteChatMessage(msg.name);
        setMessages((prev) => prev.filter((m) => m.name !== msg.name));
        setStatusBanner('Deleted message from Google Chat.');
      },
    });
  };

  // Request confirmation before adding an emoji reaction
  const requestAddReaction = (msg: GoogleChatMessage, unicodeEmoji: string) => {
    setPendingConfirmation({
      type: 'add_reaction',
      title: 'Confirm Add Emoji Reaction',
      description: `Add ${unicodeEmoji} reaction to this message in Google Chat?`,
      detailsLabel: `Target Message (${msg.name})`,
      detailsValue: `${unicodeEmoji} → "${(msg.text || '').slice(0, 120)}"`,
      confirmButtonText: `Add ${unicodeEmoji} Reaction`,
      isDestructive: false,
      onConfirm: async () => {
        await addMessageReaction(msg.name, unicodeEmoji);
        if (selectedSpace?.name) {
          await fetchMessagesAndMembers(selectedSpace.name);
        }
        setStatusBanner(`Added ${unicodeEmoji} reaction.`);
      },
    });
  };

  const executeConfirmedMutation = async () => {
    if (!pendingConfirmation) return;
    const action = pendingConfirmation.onConfirm;
    setIsMutating(true);
    setApiError(null);
    try {
      await action();
      setPendingConfirmation(null);
    } catch (err) {
      setPendingConfirmation(null);
      handleApiFailure(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenManualSpace = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualSpaceId.trim();
    if (!cleaned) return;
    const resourceName = cleaned.startsWith('spaces/')
      ? cleaned
      : `spaces/${cleaned}`;
    const existing = spaces.find((s) => s.name === resourceName);
    if (existing) {
      setSelectedSpace(existing);
    } else {
      const customSpace: GoogleChatSpace = {
        name: resourceName,
        displayName: `Space ${resourceName.replace('spaces/', '')}`,
        spaceType: 'SPACE',
      };
      setSpaces((prev) => [customSpace, ...prev]);
      setSelectedSpace(customSpace);
    }
    setManualSpaceId('');
  };

  const isConsumerAccount = isConsumerGmailAddress(user?.email);

  return (
    <section
      aria-label="Google Chat Video Collaboration Workspace"
      className="space-y-6"
    >
      {/* Top Header & Google Auth Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
            <MessageSquare className="h-4 w-4" />
            <span>GOOGLE WORKSPACE INTEGRATION · GOOGLE CHAT API v1</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Google Chat Video Collaboration Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Browse your Google Chat Spaces, collaborate with your production team, and share downloaded Reels, AI Dual-Merged videos, and CapCut AI edits directly to Google Chat with your permission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
                <span style={{ display: 'none' }}>Sign in with Google</span>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-8 w-8 rounded-full border border-slate-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-xs font-bold text-amber-300">
                  {(user?.displayName || user?.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-bold text-white">
                  {user?.displayName || 'Google User'}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {user?.email || 'Authenticated'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Upfront Google Chat API Prerequisites Notice */}
      <div className="bg-slate-900/90 border border-amber-400/30 rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <Info className="h-4 w-4 shrink-0" />
            <span>REQUIRED GOOGLE CHAT API SETUP &amp; ACCOUNT PREREQUISITES</span>
          </div>
          <a
            href={GOOGLE_CHAT_CONSOLE_CONFIG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-300 transition-colors"
          >
            <span>Open Google Chat API Configuration ({GOOGLE_CLOUD_PROJECT_ID})</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-white">
              1. Business or Enterprise Google Workspace Account
            </div>
            <p className="text-slate-400 leading-relaxed">
              Calling <code className="text-slate-200">chat.googleapis.com</code> with user authentication requires a{' '}
              <strong className="text-slate-200">Business or Enterprise Google Workspace account</strong> with access to Google Chat. Consumer{' '}
              <code className="text-amber-300">@gmail.com</code> accounts are not supported by the Google Chat API.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="font-bold text-white">
              2. Configure the Google Chat App in Google Cloud Console
            </div>
            <p className="text-slate-400 leading-relaxed">
              OAuth is enabled for project{' '}
              <code className="text-slate-200">{GOOGLE_CLOUD_PROJECT_ID}</code>, but you must complete a one-time setup on the{' '}
              <strong className="text-slate-200">Google Chat API &gt; Configuration</strong> page (enter an App Name, Avatar URL, and Description). Until configured, API requests return HTTP <code className="text-rose-300">404: Google Chat app not found</code>.
            </p>
          </div>
        </div>

        {!needsAuth && isConsumerAccount && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              You are currently signed in with a consumer{' '}
              <strong className="font-mono">{user?.email}</strong> address. If Google Chat API requests return permission errors, please switch to a Google Workspace Business or Enterprise account.
            </span>
          </div>
        )}
      </div>

      {/* Prominent Diagnostic Alert for HTTP 404 or API Errors */}
      {apiError && (
        <div
          role="alert"
          className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{apiError.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <p className="text-xs text-rose-200 leading-relaxed font-mono bg-slate-950/80 border border-rose-500/30 rounded-xl p-3">
            {apiError.message}
          </p>

          {apiError.isPrerequisiteError && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={apiError.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors"
              >
                <span>Configure Chat App in Google Cloud Console</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={fetchSpaces}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Retry Connection After Configuring
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Toast Banner */}
      {statusBanner && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Grid */}
      {needsAuth ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center mx-auto">
            <MessageSquare className="h-6 w-6 text-amber-400" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-lg font-bold text-white">
              Sign in with Google to Connect Your Google Chat Spaces
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate with your Google Workspace account to list spaces, read team messages, create new project spaces, and share ReelGrab video exports directly to Google Chat.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
                <span style={{ display: 'none' }}>Sign in with Google</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Spaces List & Create Space (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">Google Chat Spaces</h2>
                  <p className="text-[11px] text-slate-400">
                    Select a Space or create a new collaboration room
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchSpaces}
                    disabled={isLoadingSpaces}
                    title="Refresh Spaces"
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isLoadingSpaces ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateSpaceForm((v) => !v)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Space</span>
                  </button>
                </div>
              </div>

              {/* Create New Space Form */}
              {showCreateSpaceForm && (
                <form
                  onSubmit={requestCreateSpace}
                  className="p-3.5 rounded-xl bg-slate-950 border border-amber-400/30 space-y-3"
                >
                  <div className="text-xs font-bold text-amber-400">
                    Create New Google Chat Space
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">
                      Space Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      placeholder="e.g., ReelGrab Video Production"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={newSpaceDescription}
                      onChange={(e) => setNewSpaceDescription(e.target.value)}
                      placeholder="Short-form video edits & approvals"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowExternalMembers}
                      onChange={(e) => setAllowExternalMembers(e.target.checked)}
                      className="rounded border-slate-700"
                    />
                    <span>Allow external Google Workspace users</span>
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateSpaceForm(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Review &amp; Create
                    </button>
                  </div>
                </form>
              )}

              {/* Spaces List */}
              {isLoadingSpaces ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  <span>Loading your Google Chat Spaces...</span>
                </div>
              ) : spaces.length === 0 ? (
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <Hash className="h-5 w-5 text-slate-500 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">
                    No Spaces found yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click &ldquo;New Space&rdquo; above or enter a Space ID below to open a conversation.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {spaces.map((space) => {
                    const isSelected = selectedSpace?.name === space.name;
                    return (
                      <div
                        key={space.name}
                        className={`group flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-amber-400/15 border-amber-400/40 text-white'
                            : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSpace(space)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="text-xs font-bold truncate">
                            {space.displayName || space.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {space.name} · {space.spaceType || space.type || 'SPACE'}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteSpace(space)}
                          title={`Delete ${space.displayName || space.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Direct Space ID Jump */}
              <form
                onSubmit={handleOpenManualSpace}
                className="pt-2 border-t border-slate-800 space-y-1.5"
              >
                <label className="text-[11px] font-medium text-slate-400">
                  Open Space by ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSpaceId}
                    onChange={(e) => setManualSpaceId(e.target.value)}
                    placeholder="spaces/AAAA..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Video Share Selector */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Share ReelGrab Video to Chat
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Insert a formatted video summary card into your Google Chat composer.
              </p>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Optional Editor Note
                </label>
                <input
                  type="text"
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="e.g., Ready for final color & caption sign-off"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-2 pt-1">
                {/* Active Video Option */}
                <button
                  type="button"
                  onClick={() =>
                    handlePrefillVideoShare({
                      title: currentVideoInfo.title,
                      platformName: currentVideoInfo.platformName,
                      quality: '1080p',
                      filename: currentVideoInfo.filename,
                      sourceUrl: currentVideoInfo.cleanUrl,
                    })
                  }
                  className="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300 truncate">
                      Active Preview: {currentVideoInfo.title}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-400/15 text-amber-300">
                      Load Card
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    {currentVideoInfo.filename} · {currentVideoInfo.platformName}
                  </div>
                </button>

                {/* Recent Downloads Options */}
                {recentDownloads.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      handlePrefillVideoShare({
                        title: item.title,
                        platformName: item.platformName,
                        quality: item.quality,
                        filename: item.filename,
                      })
                    }
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                        Share MP4
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {item.filename} · {item.quality}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Active Space Messages & Composer (8 cols) */}
          <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 min-h-[520px]">
            {!selectedSpace ? (
              <div className="my-auto text-center py-12 space-y-2">
                <MessageSquare className="h-7 w-7 text-slate-500 mx-auto" />
                <h3 className="text-sm font-bold text-white">
                  Select or Create a Google Chat Space
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Choose a Space from the left sidebar or create a new Space to view messages and share ReelGrab video updates.
                </p>
              </div>
            ) : (
              <>
                {/* Space Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        {selectedSpace.displayName || selectedSpace.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                        {selectedSpace.name}
                      </span>
                    </div>
                    {selectedSpace.spaceDetails?.description && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedSpace.spaceDetails.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                      <Users className="h-3.5 w-3.5 text-amber-400" />
                      <span>{members.length} Member(s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchMessagesAndMembers(selectedSpace.name)}
                      disabled={isLoadingMessages}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          isLoadingMessages ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {isLoadingMessages ? (
                    <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      <span>Loading messages from {selectedSpace.name}...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1.5">
                      <p className="text-xs font-semibold text-slate-300">
                        No messages in this Space yet
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Compose a message below or click &ldquo;Load Card&rdquo; on any ReelGrab video to post the first update.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isEditing = editingMessageName === msg.name;
                      return (
                        <div
                          key={msg.name}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-300">
                                {msg.sender?.displayName ||
                                  msg.sender?.name ||
                                  'Workspace Member'}
                              </span>
                              {msg.createTime && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {new Date(msg.createTime).toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => requestAddReaction(msg, emoji)}
                                  title={`React with ${emoji}`}
                                  className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-xs transition-colors cursor-pointer"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageName(msg.name);
                                  setEditingMessageText(msg.text || '');
                                }}
                                title="Edit message"
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteMessage(msg)}
                                title="Delete message"
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={3}
                                value={editingMessageText}
                                onChange={(e) =>
                                  setEditingMessageText(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-400/50 text-xs text-white focus:outline-none"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMessageName(null);
                                    setEditingMessageText('');
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-900 text-xs text-slate-400 hover:text-white cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestUpdateMessage(msg.name)}
                                  className="px-3 py-1 rounded bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                                >
                                  Review &amp; Update
                                </button>
                              </div>
                            </div>
                          ) : (
                            <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                              {msg.text || '(Attachment / Card Message)'}
                            </pre>
                          )}

                          {msg.emojiReactionSummaries &&
                            msg.emojiReactionSummaries.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {msg.emojiReactionSummaries.map((r, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                                  >
                                    <span>{r.emoji?.unicode || '👍'}</span>
                                    <span className="font-mono">
                                      {r.reactionCount || 1}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Composer */}
                <form
                  onSubmit={requestSendMessage}
                  className="pt-3 border-t border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="google-chat-composer"
                      className="text-xs font-bold text-slate-300 flex items-center gap-1.5"
                    >
                      <SmilePlus className="h-3.5 w-3.5 text-amber-400" />
                      <span>
                        Compose Message to{' '}
                        {selectedSpace.displayName || selectedSpace.name}
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Confirmation dialog shown before sending
                    </span>
                  </div>

                  <textarea
                    id="google-chat-composer"
                    rows={3}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Write a message or click 'Load Card' on the left to share a ReelGrab video..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />

                  <div className="flex items-center justify-end gap-2">
                    {messageDraft && (
                      <button
                        type="button"
                        onClick={() => setMessageDraft('')}
                        className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!messageDraft.trim() || isMutating}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Review &amp; Send to Google Chat</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog Modal for Mutating / Destructive Operations */}
      {pendingConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-chat-confirm-title"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border ${
                    pendingConfirmation.isDestructive
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                      : 'bg-amber-400/15 border-amber-400/40 text-amber-400'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="google-chat-confirm-title"
                    className="text-base font-bold text-white"
                  >
                    {pendingConfirmation.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Explicit user confirmation required before modifying Google Chat data
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                disabled={isMutating}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingConfirmation.description}
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400">
                {pendingConfirmation.detailsLabel}
              </div>
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {pendingConfirmation.detailsValue}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                disabled={isMutating}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedMutation}
                disabled={isMutating}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  pendingConfirmation.isDestructive
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{pendingConfirmation.confirmButtonText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
