'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { getGoodellsMockConversation, type ConversationCard } from '../data/goodellsConversation';

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
  title?: string;
  highlights?: readonly string[];
};

const FAIR_GUIDE_CARDS = {
  default: {
    title: 'Trail Start · Evening Fair Loop',
    text: 'Begin at the midway near sunset, then drift toward the 4-H barns when showcase energy builds.',
    highlights: ['Golden-hour midway photos', '4-H barn walk-through', 'Grandstand-ready by dusk'],
  },
  parking: {
    title: 'Field Note · Parking & Arrival',
    text: 'Arrive before 5:30 PM for easier east-lot parking. After that window, overflow lots plus shuttle signs are the smoothest route.',
    highlights: ['Best window: before 5:30 PM', 'Use east lots first', 'Overflow + shuttle after peak'],
  },
  family: {
    title: 'Family Route · Youth-First Plan',
    text: 'Start with youth exhibits and hands-on barns, then move to kid rides before late-evening ride lines build.',
    highlights: ['Hands-on 4-H exhibits', 'Kid rides before peak', 'Snack reset between zones'],
  },
  food: {
    title: 'Fair Fuel · Classic + Local Pairing',
    text: 'Pick one classic fair treat early, then save room for a local savory plate later when crowds shift to the grandstand.',
    highlights: ['Classic sweet first', 'Local savory second', 'Shorter lines during showtime'],
  },
} as const;

function getDefaultMockResponse(question: string): ConversationCard {
  const normalized = question.toLowerCase();
  if (normalized.includes('park')) return FAIR_GUIDE_CARDS.parking;
  if (normalized.includes('family') || normalized.includes('kids')) return FAIR_GUIDE_CARDS.family;
  if (normalized.includes('food') || normalized.includes('eat')) return FAIR_GUIDE_CARDS.food;
  return FAIR_GUIDE_CARDS.default;
}

function getMockResponse(eventId: string, question: string): ConversationCard {
  if (eventId === 'goodells-fair') {
    return getGoodellsMockConversation(question);
  }

  return getDefaultMockResponse(question);
}

export default function InteractiveArtworkPage({ eventId, eventName, artworkSrc, heroVideoSrc, backHref }: InteractiveArtworkPageProps) {
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

    const atlasGuide = getMockResponse(eventId, question);

    const atlasMessage: ChatMessage = {
      id: `atlas-${Date.now() + 1}`,
      role: 'atlas',
      text: atlasGuide.text,
      title: atlasGuide.title,
      highlights: atlasGuide.highlights,
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
              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} style={styles.userChip}>
                    You: {message.text}
                  </div>
                ) : (
                  <article key={message.id} style={styles.atlasCard}>
                    {message.title ? <p style={styles.atlasCardTitle}>{message.title}</p> : null}
                    <p style={styles.atlasCardText}>{message.text}</p>
                    {message.highlights?.length ? (
                      <ul style={styles.atlasHighlights}>
                        {message.highlights.map((highlight) => (
                          <li key={highlight} style={styles.atlasHighlightItem}>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                )
              )}
            </div>
          </div>

          <form style={styles.askDock} onSubmit={handleSubmit}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Atlas for tonight’s fair route"
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
    gap: '0.42rem',
    padding: '0.42rem',
    borderRadius: '1rem',
    background: 'linear-gradient(145deg, rgba(12, 18, 30, 0.78), rgba(15, 22, 36, 0.66))',
    border: '1px solid rgba(218, 190, 132, 0.36)',
    boxShadow: '0 10px 24px rgba(5, 8, 14, 0.5), inset 0 1px 0 rgba(255, 234, 196, 0.16)',
    backdropFilter: 'blur(9px)',
  },
  askInput: {
    minWidth: 0,
    border: '1px solid rgba(228, 203, 157, 0.38)',
    borderRadius: '0.72rem',
    background: 'linear-gradient(180deg, rgba(10, 14, 22, 0.86), rgba(8, 12, 19, 0.72))',
    color: 'rgba(252, 246, 229, 0.96)',
    fontSize: '0.9rem',
    padding: '0.58rem 0.68rem',
    outline: 'none',
  },
  askButton: {
    border: '1px solid rgba(255, 216, 146, 0.5)',
    borderRadius: '0.72rem',
    background: 'linear-gradient(160deg, rgba(152, 91, 39, 0.8), rgba(104, 62, 30, 0.84))',
    color: 'rgba(255, 243, 220, 0.97)',
    fontSize: '0.83rem',
    padding: '0.55rem 0.62rem',
  },
  micButton: {
    border: '1px solid rgba(233, 204, 160, 0.36)',
    borderRadius: '0.72rem',
    background: 'linear-gradient(155deg, rgba(35, 38, 56, 0.78), rgba(22, 27, 42, 0.78))',
    color: 'rgba(245, 235, 218, 0.95)',
    fontSize: '0.82rem',
    padding: '0.55rem 0.6rem',
  },
  conversationPanel: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    bottom: '13.2%',
    height: '36%',
    zIndex: 4,
    borderRadius: '1.1rem',
    border: '1px solid rgba(225, 194, 143, 0.4)',
    background: 'linear-gradient(180deg, rgba(9, 13, 23, 0.88), rgba(10, 14, 24, 0.72) 55%, rgba(16, 21, 34, 0.7))',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 16px 34px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(252, 227, 183, 0.18)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    transition: 'transform 260ms cubic-bezier(0.2, 0.8, 0.24, 1), opacity 200ms ease',
  },
  panelHeader: {
    padding: '0.58rem 0.7rem',
    borderBottom: '1px solid rgba(229, 198, 151, 0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { margin: 0, color: 'rgba(254, 240, 211, 0.95)', fontSize: '0.79rem', letterSpacing: '0.09em', textTransform: 'uppercase' },
  minimizeButton: {
    border: '1px solid rgba(233, 205, 165, 0.38)',
    background: 'rgba(35, 28, 26, 0.6)',
    color: 'rgba(250, 233, 201, 0.94)',
    borderRadius: '999px',
    fontSize: '0.72rem',
    padding: '0.25rem 0.55rem',
  },
  messageScrollRegion: {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: '0.65rem',
    display: 'grid',
    alignContent: 'start',
    gap: '0.5rem',
  },
  userChip: {
    justifySelf: 'end',
    maxWidth: '80%',
    padding: '0.36rem 0.6rem',
    borderRadius: '0.8rem',
    background: 'linear-gradient(150deg, rgba(77, 55, 35, 0.72), rgba(52, 39, 32, 0.72))',
    border: '1px solid rgba(232, 200, 151, 0.36)',
    color: 'rgba(252, 238, 213, 0.96)',
    fontSize: '0.75rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  atlasCard: {
    marginRight: '0.9rem',
    borderRadius: '0.95rem',
    padding: '0.68rem 0.75rem',
    border: '1px solid rgba(232, 203, 158, 0.34)',
    background: 'linear-gradient(158deg, rgba(25, 34, 50, 0.88), rgba(16, 24, 39, 0.83))',
    boxShadow: 'inset 0 1px 0 rgba(255, 236, 198, 0.12), 0 8px 16px rgba(2, 6, 14, 0.24)',
  },
  atlasCardTitle: {
    margin: '0 0 0.3rem',
    color: 'rgba(255, 225, 172, 0.96)',
    fontSize: '0.71rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  atlasCardText: {
    margin: 0,
    color: 'rgba(239, 232, 219, 0.96)',
    fontSize: '0.84rem',
    lineHeight: 1.34,
  },
  atlasHighlights: {
    margin: '0.45rem 0 0',
    paddingLeft: '1rem',
    display: 'grid',
    gap: '0.2rem',
  },
  atlasHighlightItem: {
    color: 'rgba(231, 213, 185, 0.95)',
    fontSize: '0.76rem',
    lineHeight: 1.25,
  },
};
