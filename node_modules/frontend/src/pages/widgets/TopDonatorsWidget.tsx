import { useState, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { TopDonatorsUpdatedPayload } from '@donation-app/shared-types';

interface Donator {
  senderName: string;
  total:      number;
}

export default function TopDonatorsWidget() {
  const [donators, setDonators] = useState<Donator[]>([]);
  const [limit,    setLimit]    = useState(5);

  useEffect(() => {
    api.get<{ donators: Donator[]; limit: number }>('/api/widget/top-donators')
      .then(({ data }) => {
        setDonators(data.donators);
        setLimit(data.limit);
      })
      .catch(console.error);

    socket.connect();

    const handleUpdate = (payload: TopDonatorsUpdatedPayload) => {
      setDonators(payload.donators);
    };

    socket.on(SOCKET_EVENTS.TOP_DONATORS_UPDATED, handleUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.TOP_DONATORS_UPDATED, handleUpdate);
      socket.disconnect();
    };
  }, []);

  const maxTotal = donators[0]?.total ?? 1;

  return (
    <div style={{ background: 'transparent', padding: '16px', fontFamily: 'sans-serif', color: '#fff', minWidth: '280px' }}>
      <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px', opacity: 0.7, letterSpacing: '1px', textTransform: 'uppercase' }}>
        Top {limit} Donators
      </div>

      {donators.length === 0 ? (
        <div style={{ opacity: 0.4, fontSize: '13px' }}>No donations yet</div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {donators.map((d, i) => {
            const barPercent = (d.total / maxTotal) * 100;
            return (
              <li key={d.senderName} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>
                    <span style={{ opacity: 0.5, marginRight: '6px' }}>#{i + 1}</span>
                    {d.senderName}
                  </span>
                  <span style={{ color: '#FFB627', fontWeight: 600 }}>
                    ฿{d.total.toLocaleString()}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '2px', height: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${barPercent}%`,
                    background: i === 0 ? '#FFB627' : '#38E1C6',
                    transition: 'width 0.8s ease',
                    opacity: i === 0 ? 1 : 0.6,
                  }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
