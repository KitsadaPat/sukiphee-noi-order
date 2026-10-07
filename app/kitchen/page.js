'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ACTIVE = ['received', 'cooking'];

const s = {
  page: { minHeight: '100vh', background: '#1c1c1e', color: '#fff', padding: 16 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 12, marginBottom: 16,
  },
  title: { fontSize: 38, fontWeight: 800, margin: 0 },
  stats: { fontSize: 26, fontWeight: 600, display: 'flex', gap: 20, alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 },
  card: (cooking) => ({
    background: cooking ? '#ffb300' : '#fafafa',
    color: '#212121',
    border: cooking ? '6px solid #e65100' : '6px solid #90a4ae',
    borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column',
  }),
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  table: { fontSize: 64, fontWeight: 900, lineHeight: 1, margin: 0 },
  time: { textAlign: 'right', fontSize: 24, fontWeight: 700, lineHeight: 1.3 },
  ago: { fontSize: 20, fontWeight: 600, opacity: 0.8 },
  list: { listStyle: 'none', padding: 0, margin: '14px 0', flex: 1 },
  li: {
    display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 30, fontWeight: 700,
    padding: '6px 0', borderBottom: '2px dashed rgba(0,0,0,0.2)',
  },
  qty: { flex: '0 0 auto' },
  btnRow: { display: 'flex', gap: 10 },
  btnStart: (disabled) => ({
    flex: 1, fontSize: 26, fontWeight: 800, padding: '16px 8px', borderRadius: 12, border: 'none',
    cursor: disabled ? 'default' : 'pointer', color: '#fff',
    background: disabled ? '#bdbdbd' : '#ef6c00',
  }),
  btnServe: (disabled) => ({
    flex: 1, fontSize: 26, fontWeight: 800, padding: '16px 8px', borderRadius: 12, border: 'none',
    cursor: disabled ? 'default' : 'pointer', color: '#fff',
    background: disabled ? '#9e9e9e' : '#2e7d32',
  }),
  empty: { textAlign: 'center', fontSize: 40, opacity: 0.6, marginTop: 120 },
};

function sortOrders(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function parseItems(raw) {
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? v : [];
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function minutesAgo(iso, now) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [online, setOnline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(() => new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const mounted = useRef(true);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, session_id, table_number, items, status, created_at')
      .in('status', ACTIVE)
      .order('created_at', { ascending: true });
    if (!mounted.current) return;
    if (error) {
      setErrorMsg(`โหลดออเดอร์ไม่สำเร็จ: ${error.message}`);
      return;
    }
    setErrorMsg('');
    setOrders(sortOrders(data || []));
  }, []);

  // โหลดครั้งแรก + ตัวช่วยสำรอง (โหลดซ้ำทุก 60 วินาที เผื่อ realtime หลุดโดยไม่รู้ตัว)
  useEffect(() => {
    mounted.current = true;
    loadOrders();
    const poll = setInterval(loadOrders, 60000);
    return () => {
      mounted.current = false;
      clearInterval(poll);
    };
  }, [loadOrders]);

  // นาฬิกาสำหรับ "กี่นาทีที่แล้ว"
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Realtime: INSERT และ UPDATE ของตาราง orders
  useEffect(() => {
    const upsert = (row) => {
      setOrders((prev) => {
        const without = prev.filter((o) => o.id !== row.id);
        if (!ACTIVE.includes(row.status)) return without; // เช่น served -> เอาออก
        return sortOrders([...without, row]);
      });
    };

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => upsert(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (p) => upsert(p.new))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setOnline(true);
          loadOrders(); // ดึงซ้ำเพื่อชดเชยช่วงที่เชื่อมต่อหลุด
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setOnline(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function changeStatus(order, newStatus) {
    if (busy.has(order.id)) return;
    setBusy((b) => new Set(b).add(order.id));
    setErrorMsg('');

    // อัปเดตหน้าจอทันที
    const snapshot = orders;
    if (newStatus === 'served') {
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } else {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o)));
    }

    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    if (error) {
      setErrorMsg(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
      setOrders(snapshot);
      loadOrders();
    }
    setBusy((b) => {
      const n = new Set(b);
      n.delete(order.id);
      return n;
    });
  }

  const waiting = orders.filter((o) => o.status === 'received').length;
  const cooking = orders.filter((o) => o.status === 'cooking').length;

  return (
    <main style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>ครัว · สุกี้ผีน้อย</h1>
        <div style={s.stats}>
          <span>รอทำ {waiting}</span>
          <span style={{ color: '#ffb300' }}>กำลังทำ {cooking}</span>
          <span style={{ color: online ? '#66bb6a' : '#ef5350' }}>
            ● {online ? 'ออนไลน์' : 'ขาดการเชื่อมต่อ'}
          </span>
        </div>
      </header>

      {errorMsg && (
        <p style={{ background: '#b71c1c', padding: 12, borderRadius: 10, fontSize: 22, fontWeight: 700 }}>
          {errorMsg}
        </p>
      )}

      {orders.length === 0 ? (
        <p style={s.empty}>ยังไม่มีออเดอร์</p>
      ) : (
        <section style={s.grid}>
          {orders.map((order) => {
            const isCooking = order.status === 'cooking';
            const isBusy = busy.has(order.id);
            return (
              <article key={order.id} style={s.card(isCooking)}>
                <div style={s.cardTop}>
                  <p style={s.table}>โต๊ะ {order.table_number}</p>
                  <div style={s.time}>
                    {formatTime(order.created_at)}
                    <div style={s.ago}>{minutesAgo(order.created_at, now)} นาทีที่แล้ว</div>
                  </div>
                </div>

                <ul style={s.list}>
                  {parseItems(order.items).map((it, idx) => (
                    <li key={idx} style={s.li}>
                      <span>{it.name}</span>
                      <span style={s.qty}>× {it.quantity}</span>
                    </li>
                  ))}
                </ul>

                <div style={s.btnRow}>
                  <button
                    type="button"
                    style={s.btnStart(isCooking || isBusy)}
                    disabled={isCooking || isBusy}
                    onClick={() => changeStatus(order, 'cooking')}
                  >
                    {isCooking ? 'กำลังทำ' : 'เริ่มทำ'}
                  </button>
                  <button
                    type="button"
                    style={s.btnServe(isBusy)}
                    disabled={isBusy}
                    onClick={() => changeStatus(order, 'served')}
                  >
                    จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
