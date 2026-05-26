'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';

type InteractiveArtworkPageProps = {
  eventId: string;
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'atlas';
  text: string;
};

const FALLBACK_RESPONSES = [
  'Start at the midway around golden hour, then walk to the 4-H barns for the evening animal showcases.',
  'For families, begin with youth exhibits, then move to kid rides before the grandstand crowds build.',
  'Fair food tip: grab a classic elephant ear first, then save room for a local barbecue plate later in the night.',
  'Parking is easiest near the east lots before 5:30 PM. After that, use overflow and follow shuttle signs.',
];

function getMockResponse(question: string): string {
  const normalized = question.toLowerCase();
  if (normalized.includes('park')) return FALLBACK_RESPONSES[3];
  if (normalized.includes('family') || normalized.includes('kids')) return FALLBACK_RESPONSES[1];
  if (normalized.includes('food') || normalized.includes('eat')) return FALLBACK_RESPONSES[2];
  return FALLBACK_RESPONSES[0];
}

export default function InteractiveArtworkPage({ eventName, artworkSrc, heroVideoSrc, backHref }: InteractiveArtworkPageProps) {
  const [draft, setDraft] = useState('');
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('event-detail-scroll');
    document.body.classList.add('event-detail-scroll');

    return () => {
      document.documentElement.classList.remove('event-detail-scroll');
      document.body.classList.remove('event-detail-scroll');
    };
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isConversationOpen]);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);

  const handleSend = () => {
    const question = draft.trim();
    if (!question) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
    };

    const atlasMessage: ChatMessage = {
      id: `atlas-${Date.now() + 1}`,
      role: 'atlas',
      text: getMockResponse(question),
    };

    setMessages((current) => [...current, userMessage, atlasMessage]);
    setDraft('');
    setIsConversationOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSend();
  };

  return (
    <main style={styles.page}>
      <section style={styles.parchmentColumn} aria-label={`${eventName} memory collage`}>
        <div style={styles.artworkShell}>
          <img src={artworkSrc} alt={`${eventName} scrapbook artwork`} style={styles.artworkImage} />

          <div style={styles.videoRegion} aria-label="Hero video region">
            <video src={heroVideoSrc} muted autoPlay loop playsInline controls style={styles.video} />
          </div>

          <Link href={backHref} style={styles.topBackLink}>
            ← Back to Atlas
          </Link>

          <div
            style={{
              ...styles.conversationPanel,
              transform: isConversationOpen ? 'translateY(0)' : 'translateY(103%)',
              opacity: isConversationOpen ? 1 : 0,
              pointerEvents: isConversationOpen ? 'auto' : 'none',
            }}
            aria-hidden={!isConversationOpen}
          >
            <div style={styles.panelHeader}>
              <p style={styles.panelTitle}>Atlas Conversation</p>
              <button type="button" style={styles.minimizeButton} onClick={() => setIsConversationOpen(false)}>
                Minimize
              </button>
            </div>
            <div ref={scrollRef} style={styles.messageScrollRegion}>
              {messages.map((message) => (
                <div key={message.id} style={message.role === 'user' ? styles.userBubble : styles.atlasBubble}>
                  {message.text}
                </div>
              ))}
            </div>
          </div>

          <form style={styles.askDock} onSubmit={handleSubmit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Anything About the Fair..."
              style={styles.askInput}
              aria-label="Ask anything about the fair"
            />
            <button type="submit" style={styles.askButton} disabled={!canSend}>
              Send
            </button>
            <button type="button" style={styles.micButton} aria-label="Speak (coming soon)">
              Mic
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 20% 10%, rgba(83, 53, 34, 0.34), transparent 32%), radial-gradient(circle at 80% 30%, rgba(67, 43, 28, 0.32), transparent 28%), linear-gradient(180deg, #1f130d 0%, #2b1a11 55%, #1a100b 100%)',
    color: '#3b2818',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 1rem 2rem',
  },
  parchmentColumn: {
    width: 'min(100%, 760px)',
    background: 'linear-gradient(180deg, rgba(248, 232, 198, 0.98), rgba(236, 210, 170, 0.97))',
    border: '1px solid rgba(150, 116, 75, 0.52)',
    borderTop: 'none',
    borderBottomLeftRadius: '0.8rem',
    borderBottomRightRadius: '0.8rem',
    boxShadow: '0 20px 35px rgba(13, 6, 4, 0.46)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'start',
    position: 'relative',
    zIndex: 0,
    overflow: 'hidden',
  },
  artworkShell: { position: 'relative', width: '100%' },
  artworkImage: { display: 'block', width: '100%', height: 'auto' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  topBackLink: {
    position: 'absolute',
    top: '0.6rem',
    left: '0.65rem',
    zIndex: 3,
    textDecoration: 'none',
    color: 'rgba(61, 39, 22, 0.85)',
    background: 'rgba(248, 233, 205, 0.64)',
    border: '1px solid rgba(128, 95, 63, 0.3)',
    borderRadius: '999px',
    padding: '0.28rem 0.58rem',
    fontSize: '0.74rem',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(1.5px)',
  },
  askDock: {
    position: 'absolute',
    left: '6%',
    bottom: '2.5%',
    width: '88%',
    zIndex: 4,
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '0.45rem',
    padding: '0.5rem',
    borderRadius: '0.85rem',
    background: 'rgba(11, 14, 22, 0.62)',
    border: '1px solid rgba(220, 226, 243, 0.25)',
    backdropFilter: 'blur(7px)',
  },
  askInput: {
    minWidth: 0,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '0.65rem',
    background: 'rgba(7, 10, 16, 0.62)',
    color: 'rgba(243, 247, 255, 0.95)',
    fontSize: '0.9rem',
    padding: '0.55rem 0.65rem',
    outline: 'none',
  },
  askButton: {
    border: '1px solid rgba(175, 212, 255, 0.42)',
    borderRadius: '0.65rem',
    background: 'rgba(70, 123, 196, 0.4)',
    color: 'rgba(237, 246, 255, 0.95)',
    fontSize: '0.83rem',
    padding: '0.55rem 0.62rem',
  },
  micButton: {
    border: '1px solid rgba(234, 240, 255, 0.34)',
    borderRadius: '0.65rem',
    background: 'rgba(33, 40, 58, 0.48)',
    color: 'rgba(239, 245, 255, 0.92)',
    fontSize: '0.82rem',
    padding: '0.55rem 0.6rem',
  },
  conversationPanel: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    bottom: '16%',
    height: '44%',
    zIndex: 4,
    borderRadius: '1rem',
    border: '1px solid rgba(204, 218, 243, 0.24)',
    background: 'linear-gradient(180deg, rgba(8, 11, 18, 0.74), rgba(8, 11, 18, 0.6))',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.42)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    transition: 'transform 280ms ease, opacity 220ms ease',
  },
  panelHeader: {
    padding: '0.58rem 0.7rem',
    borderBottom: '1px solid rgba(195, 214, 245, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { margin: 0, color: 'rgba(238, 244, 255, 0.92)', fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase' },
  minimizeButton: {
    border: '1px solid rgba(211, 225, 246, 0.34)',
    background: 'rgba(26, 34, 51, 0.58)',
    color: 'rgba(232, 241, 255, 0.93)',
    borderRadius: '999px',
    fontSize: '0.72rem',
    padding: '0.25rem 0.55rem',
  },
  messageScrollRegion: {
    overflowY: 'auto',
    padding: '0.65rem',
    display: 'grid',
    alignContent: 'start',
    gap: '0.5rem',
  },
  userBubble: {
    marginLeft: '2.4rem',
    padding: '0.52rem 0.62rem',
    borderRadius: '0.7rem',
    background: 'rgba(95, 145, 224, 0.35)',
    color: 'rgba(239, 245, 255, 0.96)',
    fontSize: '0.86rem',
    lineHeight: 1.35,
  },
  atlasBubble: {
    marginRight: '2.4rem',
    padding: '0.52rem 0.62rem',
    borderRadius: '0.7rem',
    background: 'rgba(39, 49, 70, 0.62)',
    color: 'rgba(230, 238, 254, 0.96)',
    fontSize: '0.86rem',
    lineHeight: 1.35,
  },
};
