import { useEffect, useRef, useState } from 'react';
import { chatService } from '../../services/chatService.js';
import { socket } from '../../sockets/socket.js';

const TYPING_HIDE_AFTER = 2500;
const TYPING_EMIT_INTERVAL = 1200;

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDateDivider(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  if (isSameDay(date, today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ChatPanel({ collaborationId, currentUserId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const listRef = useRef(null);
  const typingHideTimer = useRef(null);
  const lastTypingEmitAt = useRef(0);

  // Always fetched on mount: on desktop the panel is a persistent sidebar,
  // so there's no "open" action to gate the fetch behind.
  useEffect(() => {
    chatService.getHistory(collaborationId).then(({ data }) => setMessages(data.messages));
  }, [collaborationId]);

  useEffect(() => {
    function handleMessage(message) {
      if (message.collaboration !== collaborationId) return;
      setMessages((prev) => (prev ? [...prev, message] : prev));
    }
    // The server only relays "typing right now" pings, not a "stopped typing"
    // event, so the indicator hides itself if no new ping arrives in time.
    function handleTyping({ collaborationId: incomingId }) {
      if (incomingId !== collaborationId) return;
      setIsOtherTyping(true);
      clearTimeout(typingHideTimer.current);
      typingHideTimer.current = setTimeout(() => setIsOtherTyping(false), TYPING_HIDE_AFTER);
    }
    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      clearTimeout(typingHideTimer.current);
    };
  }, [collaborationId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  function handleDraftChange(event) {
    setDraft(event.target.value);
    const now = Date.now();
    if (now - lastTypingEmitAt.current > TYPING_EMIT_INTERVAL) {
      socket.emit('chat:typing', { collaborationId });
      lastTypingEmitAt.current = now;
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setIsSending(true);
    try {
      await chatService.sendMessage(collaborationId, trimmed);
      setDraft('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    // Below lg it's a collapsible accordion (no room for a sidebar on
    // narrow screens); at lg+ it becomes a persistent right-hand sidebar
    // that sticks in place while the main column scrolls.
    <div className="flex flex-col rounded-2xl border border-charcoal/10 bg-white/50 shadow-soft lg:sticky lg:top-12 lg:h-[calc(100vh-6rem)]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="chat-panel-content"
        className="flex items-center justify-between px-5 py-3 text-sm font-medium text-charcoal/70 lg:pointer-events-none"
      >
        <span>Chat</span>
        <span
          aria-hidden="true"
          className={`text-charcoal/40 transition-transform lg:hidden ${isOpen ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </button>

      <div
        id="chat-panel-content"
        className={`${
          isOpen ? 'flex' : 'hidden'
        } flex-col gap-3 border-t border-charcoal/10 px-5 py-4 lg:flex lg:min-h-0 lg:flex-1`}
      >
        <div ref={listRef} className="flex max-h-64 flex-col gap-2 overflow-y-auto lg:max-h-none lg:flex-1">
          {messages === null ? (
            <p className="text-sm text-charcoal/40">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-charcoal/40">No messages yet.</p>
          ) : (
            messages.map((message, index) => {
              const isMine = message.sender._id === currentUserId;
              const previous = messages[index - 1];
              const showDateDivider =
                !previous || !isSameDay(new Date(message.createdAt), new Date(previous.createdAt));

              return (
                <div key={message._id} className="flex flex-col gap-2">
                  {showDateDivider && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="h-px flex-1 bg-charcoal/10" />
                      <span className="text-[11px] text-charcoal/40">
                        {formatDateDivider(message.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-charcoal/10" />
                    </div>
                  )}
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm ${
                        isMine ? 'bg-indigo text-paper' : 'bg-charcoal/5 text-charcoal'
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="mt-0.5 text-[11px] text-charcoal/40">
                      {isMine ? 'You' : message.sender.displayName} · {formatTime(message.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {isOtherTyping && <p className="text-xs italic text-charcoal/40">Typing…</p>}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            value={draft}
            onChange={handleDraftChange}
            placeholder="Say something…"
            className="min-w-0 flex-1 rounded-lg border border-charcoal/15 bg-white/70 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="shrink-0 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
