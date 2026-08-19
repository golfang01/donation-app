import { useState, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { TopDonatorsUpdatedPayload } from '@donation-app/shared-types';

interface Donator { senderName: string; total: number; }

interface WidgetState {
  donators:       Donator[];
  limit:          number;
  topFont:        string;
  topTextColor:   string;
  topAccentColor: string;
  topBarColor:    string;
  topLayout:      string;
  topShowBar:     boolean;
}

export default function TopDonatorsWidget() {
  const [state, setState] = useState<WidgetState | null>(null);

  useEffect(() => {
    api.get<WidgetState>('/api/widget/top-donators')
      .then(({ data }) => setState(data))
      .catch(console.error);

    socket.connect();

    const handleUpdate = (payload: TopDonatorsUpdatedPayload) => {
      setState((prev) => prev ? { ...prev, donators: payload.donators } : null);
    };

    socket.on(SOCKET_EVENTS.TOP_DONATORS_UPDATED, handleUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.TOP_DONATORS_UPDATED, handleUpdate);
      socket.disconnect();
    };
  }, []);

  if (!state) return null;
  if (state.donators.length === 0) return null;

  const { donators, topFont, topTextColor, topAccentColor, topBarColor, topLayout, topShowBar, limit } = state;
  const maxTotal   = donators[0]?.total ?? 1;
  const fontFace   = { fontFamily: `'${topFont}', sans-serif` };
  const textShadow = '0 0 4px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px -1px 0 #000';

  // ── Podium layout ────────────────────────────────────────────────────────
  if (topLayout === 'podium' && donators.length >= 3) {
    const [first, second, third, ...rest] = donators;
    // Podium display order: 2nd (left), 1st (centre, tallest), 3rd (right)
    const podiumOrder = [
      { d: second, rank: 2, height: '80px',  color: topTextColor  },
      { d: first,  rank: 1, height: '112px', color: topAccentColor },
      { d: third,  rank: 3, height: '56px',  color: topTextColor  },
    ];

    return (
      <div style={{ background: 'transparent', padding: '12px', display: 'inline-block', minWidth: '280px' }}>
        {/* Title */}
        <div style={{ ...fontFace, fontSize: '11px', color: topTextColor, opacity: 0.5, letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px', textShadow }}>
          Top {limit} Donators
        </div>

        {/* Podium blocks */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          {podiumOrder.map(({ d, rank, height, color }) => (
            <div key={d.senderName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ ...fontFace, fontSize: '13px', fontWeight: 700, color, textShadow, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.senderName}
              </span>
              <span style={{ ...fontFace, fontSize: '11px', color, opacity: 0.8, textShadow }}>
                ฿{d.total.toLocaleString()}
              </span>
              <div style={{ width: '72px', height, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: rank === 1 ? 1 : 0.7 }}>
                <span style={{ fontFamily: fontFace.fontFamily, fontSize: '20px', fontWeight: 900, color: '#000', opacity: 0.6 }}>
                  {rank}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Remaining entries below podium */}
        {rest.map((d, i) => (
          <div key={d.senderName} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', ...fontFace }}>
            <span style={{ fontSize: '12px', color: topTextColor, textShadow }}>
              <span style={{ color: topTextColor, opacity: 0.4, marginRight: '6px' }}>#{i + 4}</span>
              {d.senderName}
            </span>
            <span style={{ fontSize: '12px', color: topBarColor, fontWeight: 600, textShadow }}>
              ฿{d.total.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // ── List layout (default) ────────────────────────────────────────────────
  return (
    <div style={{ background: 'transparent', padding: '12px', display: 'inline-block', minWidth: '260px' }}>
      {/* Title */}
      <div style={{ ...fontFace, fontSize: '11px', color: topTextColor, opacity: 0.5, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px', textShadow }}>
        Top {limit} Donators
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {donators.map((d, i) => {
          const barPercent = (d.total / maxTotal) * 100;
          const isFirst    = i === 0;
          const rowColor   = isFirst ? topAccentColor : topTextColor;

          return (
            <div key={d.senderName} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', ...fontFace }}>
                <span style={{ fontSize: '14px', color: rowColor, textShadow }}>
                  <span style={{ color: isFirst ? topAccentColor : topTextColor, opacity: isFirst ? 1 : 0.45, marginRight: '6px', fontWeight: isFirst ? 700 : 400 }}>
                    #{i + 1}
                  </span>
                  {d.senderName}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: isFirst ? topAccentColor : topBarColor, textShadow }}>
                  ฿{d.total.toLocaleString()}
                </span>
              </div>

              {topShowBar && (
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${barPercent}%`,
                    background: isFirst ? topAccentColor : topBarColor,
                    opacity: isFirst ? 1 : 0.55,
                    transition: 'width 0.8s ease',
                    borderRadius: '2px',
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
