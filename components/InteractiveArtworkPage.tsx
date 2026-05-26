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
              <p style={styles.panelTitle}>Goodells Field Notes</p>
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
              Share
            </button>
            <button type="button" style={styles.micButton} aria-label="Speak (coming soon)">
              ◉
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
    left: '5%',
    bottom: '2.5%',
    width: '90%',
    zIndex: 4,
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '0.46rem',
    padding: '0.48rem',
    borderRadius: '1.12rem',
    background:
      'linear-gradient(170deg, rgba(53, 40, 29, 0.52), rgba(35, 27, 22, 0.41) 46%, rgba(20, 18, 21, 0.35)), radial-gradient(circle at 16% 8%, rgba(255, 219, 160, 0.22), transparent 40%)',
    border: '1px solid rgba(244, 216, 171, 0.24)',
    boxShadow: '0 14px 26px rgba(7, 4, 2, 0.35), inset 0 1px 0 rgba(255, 236, 206, 0.2)',
    backdropFilter: 'blur(8px)',
  },
  askInput: {
    minWidth: 0,
    border: '1px solid rgba(236, 206, 161, 0.24)',
    borderRadius: '0.82rem',
    background: 'linear-gradient(180deg, rgba(25, 21, 21, 0.48), rgba(21, 17, 18, 0.4))',
    color: 'rgba(255, 245, 226, 0.96)',
    fontSize: '0.84rem',
    padding: '0.62rem 0.75rem',
    outline: 'none',
  },
  askButton: {
    border: '1px solid rgba(253, 222, 173, 0.38)',
    borderRadius: '0.82rem',
    background: 'linear-gradient(165deg, rgba(122, 79, 47, 0.7), rgba(86, 56, 35, 0.74))',
    color: 'rgba(255, 246, 229, 0.98)',
    fontSize: '0.78rem',
    letterSpacing: '0.03em',
    padding: '0.58rem 0.74rem',
  },
  micButton: {
    border: '1px solid rgba(235, 209, 171, 0.26)',
    borderRadius: '0.82rem',
    background: 'linear-gradient(155deg, rgba(74, 56, 43, 0.58), rgba(42, 35, 34, 0.54))',
    color: 'rgba(252, 235, 209, 0.95)',
    fontSize: '0.9rem',
    lineHeight: 1,
    padding: '0.55rem 0.68rem',
  },
  conversationPanel: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    bottom: '13.2%',
    height: '36%',
    zIndex: 4,
    borderRadius: '1.28rem 1.28rem 0.95rem 0.95rem',
    border: '1px solid rgba(243, 212, 168, 0.22)',
    background:
      'linear-gradient(180deg, rgba(30, 23, 21, 0.72), rgba(23, 21, 24, 0.62) 45%, rgba(19, 19, 24, 0.54) 100%), radial-gradient(circle at 22% 0%, rgba(255, 214, 153, 0.14), transparent 46%)',
    backdropFilter: 'blur(9px)',
    boxShadow: '0 20px 30px rgba(5, 2, 2, 0.34), inset 0 1px 0 rgba(255, 235, 201, 0.16)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    transition: 'transform 560ms cubic-bezier(0.18, 0.76, 0.24, 1), opacity 420ms ease',
  },
  panelHeader: {
    padding: '0.56rem 0.8rem 0.52rem',
    borderBottom: '1px solid rgba(232, 201, 154, 0.17)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { margin: 0, color: 'rgba(250, 231, 197, 0.94)', fontSize: '0.66rem', letterSpacing: '0.13em', textTransform: 'uppercase' },
  minimizeButton: {
    border: '1px solid rgba(237, 210, 168, 0.24)',
    background: 'rgba(47, 35, 29, 0.38)',
    color: 'rgba(249, 232, 200, 0.9)',
    borderRadius: '999px',
    fontSize: '0.66rem',
    letterSpacing: '0.04em',
    padding: '0.28rem 0.58rem',
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
    maxWidth: '84%',
    padding: '0.42rem 0.68rem',
    borderRadius: '0.84rem',
    background: 'linear-gradient(150deg, rgba(104, 76, 52, 0.54), rgba(71, 53, 43, 0.45))',
    border: '1px solid rgba(232, 200, 151, 0.22)',
    color: 'rgba(254, 242, 219, 0.95)',
    fontSize: '0.73rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  atlasCard: {
    marginRight: '0.75rem',
    borderRadius: '1rem',
    padding: '0.72rem 0.78rem',
    border: '1px solid rgba(243, 212, 166, 0.2)',
    background:
      'linear-gradient(158deg, rgba(42, 34, 30, 0.62), rgba(32, 29, 34, 0.58)), radial-gradient(circle at 100% 0%, rgba(255, 215, 158, 0.08), transparent 40%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 238, 205, 0.11), 0 10px 14px rgba(12, 9, 8, 0.14)',
  },
  atlasCardTitle: {
    margin: '0 0 0.3rem',
    color: 'rgba(244, 214, 171, 0.95)',
    fontSize: '0.66rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  atlasCardText: {
    margin: 0,
    color: 'rgba(244, 236, 224, 0.95)',
    fontSize: '0.82rem',
    lineHeight: 1.38,
  },
  atlasHighlights: {
    margin: '0.45rem 0 0',
    paddingLeft: '1rem',
    display: 'grid',
    gap: '0.2rem',
  },
  atlasHighlightItem: {
    color: 'rgba(236, 219, 194, 0.92)',
    fontSize: '0.73rem',
    lineHeight: 1.25,
  },
};
