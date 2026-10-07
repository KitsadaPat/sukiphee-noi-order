'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ADULT_PRICE = 289;
const CHILD_PRICE = 145;
const MAX_QTY_PER_ITEM = 5;
const MAX_ITEMS_PER_ORDER = 10;

const c = {
  bg: '#fff8ef',
  card: '#ffffff',
  primary: '#c62828',
  dark: '#3e2723',
  accent: '#ef6c00',
  line: '#eadfce',
};

const s = {
  page: { minHeight: '100vh', background: c.bg, color: c.dark, paddingBottom: 110 },
  full: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', padding: 24, background: c.bg, color: c.dark,
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20, background: c.primary, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
  },
  billBtn: {
    background: '#fff', color: c.primary, border: 'none', borderRadius: 999,
    fontSize: 17, fontWeight: 700, padding: '10px 16px', cursor: 'pointer',
  },
  tabs: {
    position: 'sticky', top: 62, zIndex: 15, display: 'flex', gap: 8, overflowX: 'auto',
    padding: '10px 12px', background: c.bg, borderBottom: `1px solid ${c.line}`,
  },
  tab: (active) => ({
    flex: '0 0 auto', fontSize: 18, fontWeight: 700, padding: '12px 18px', borderRadius: 999,
    border: `2px solid ${c.primary}`, cursor: 'pointer',
    background: active ? c.primary : '#fff', color: active ? '#fff' : c.primary,
  }),
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    background: c.card, border: `1px solid ${c.line}`, borderRadius: 14,
    padding: '12px 14px', margin: '10px 12px',
  },
  itemName: { fontSize: 20, fontWeight: 600, flex: 1 },
  plus: {
    width: 56, height: 56, borderRadius: '50%', border: 'none', background: c.accent,
    color: '#fff', fontSize: 34, lineHeight: 1, fontWeight: 700, cursor: 'pointer', flex: '0 0 auto',
  },
  badge: {
    background: c.primary, color: '#fff', borderRadius: 999, fontSize: 15, fontWeight: 700,
    padding: '2px 10px', marginLeft: 8,
  },
  cartBar: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, padding: 12,
    background: 'linear-gradient(transparent, rgba(255,248,239,0.95) 30%)',
  },
  cartBtn: {
    width: '100%', fontSize: 22, fontWeight: 700, padding: 18, border: 'none',
    borderRadius: 16, background: c.primary, color: '#fff', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    background: '#fff', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
    borderRadius: '20px 20px 0 0', padding: 18,
  },
  modal: {
    background: '#fff', width: '100%', maxWidth: 420, borderRadius: 18, padding: 22,
    margin: 'auto 16px',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 0', borderBottom: `1px solid ${c.line}`, fontSize: 19,
  },
  step: {
    width: 44, height: 44, borderRadius: '50%', border: `2px solid ${c.primary}`,
    background: '#fff', color: c.primary, fontSize: 24, fontWeight: 700, cursor: 'pointer',
  },
  primaryBtn: {
    width: '100%', fontSize: 22, fontWeight: 700, padding: 16, border: 'none',
    borderRadius: 14, background: c.primary, color: '#fff', cursor: 'pointer', marginTop: 14,
  },
  grayBtn: {
    flex: 1, fontSize: 20, fontWeight: 700, padding: 14, border: 'none', borderRadius: 12,
    background: '#9e9e9e', color: '#fff', cursor: 'pointer',
  },
  redBtn: {
    flex: 1, fontSize: 20, fontWeight: 700, padding: 14, border: 'none', borderRadius: 12,
    background: c.primary, color: '#fff', cursor: 'pointer',
  },
  toast: {
    position: 'fixed', top: 70, left: 12, right: 12, zIndex: 60, textAlign: 'center',
    background: '#2e7d32', color: '#fff', fontSize: 22, fontWeight: 700, padding: 14,
    borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
  },
  error: { color: '#c62828', fontWeight: 600, fontSize: 17, margin: '10px 0 0' },
};

export default function OrderPage({ params }) {
  // Next.js เวอร์ชันล่าสุด: params เป็น Promise ต้อง unwrap ด้วย use()
  const { tableNumber } = use(params);

  const [status, setStatus] = useState('loading'); // loading | closedTable | ready | finished | error
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);

  const [cart, setCart] = useState([]); // [{ id, name, quantity }]
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showBill, setShowBill] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const tableNo = Number(tableNumber);
      if (!Number.isInteger(tableNo) || tableNo <= 0) {
        setStatus('closedTable');
        return;
      }
      try {
        const { data: rows, error: sErr } = await supabase
          .from('sessions')
          .select('id, adult_count, child_count')
          .eq('table_number', tableNo)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);
        if (sErr) throw sErr;
        if (cancelled) return;

        if (!rows || rows.length === 0) {
          setStatus('closedTable');
          return;
        }
        setSession(rows[0]);

        const [catRes, itemRes] = await Promise.all([
          supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
          supabase.from('menu_items').select('id, category_id, name').order('id', { ascending: true }),
        ]);
        if (catRes.error) throw catRes.error;
        if (itemRes.error) throw itemRes.error;
        if (cancelled) return;

        setCategories(catRes.data || []);
        setItems(itemRes.data || []);
        setActiveCat(catRes.data && catRes.data.length > 0 ? catRes.data[0].id : null);
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || String(err));
          setStatus('error');
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tableNumber]);

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  }

  function addToCart(item) {
    setErrorMsg('');
    const found = cart.find((x) => x.id === item.id);
    if (found) {
      if (found.quantity >= MAX_QTY_PER_ITEM) {
        flash(`สั่งได้สูงสุด ${MAX_QTY_PER_ITEM} ที่ต่อรายการ`);
        return;
      }
      setCart(cart.map((x) => (x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x)));
      return;
    }
    if (cart.length >= MAX_ITEMS_PER_ORDER) {
      flash(`ส่งได้สูงสุด ${MAX_ITEMS_PER_ORDER} รายการต่อครั้ง`);
      return;
    }
    setCart([...cart, { id: item.id, name: item.name, quantity: 1 }]);
  }

  function changeQty(id, delta) {
    setCart(
      cart
        .map((x) => (x.id === id ? { ...x, quantity: Math.min(MAX_QTY_PER_ITEM, x.quantity + delta) } : x))
        .filter((x) => x.quantity > 0)
    );
  }

  async function sendOrder() {
    if (cart.length === 0 || sending) return;
    setSending(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: Number(tableNumber),
        items: cart.map(({ name, quantity }) => ({ name, quantity })),
        status: 'received',
      });
      if (error) throw error;
      setCart([]);
      setShowCart(false);
      flash('ส่งออเดอร์แล้ว');
    } catch (err) {
      setErrorMsg(`ส่งออเดอร์ไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSending(false);
    }
  }

  async function confirmBill() {
    setClosing(true);
    setErrorMsg('');
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open')
        .select('id');
      if (error) throw error;
      setShowBill(false);
      setStatus('finished');
    } catch (err) {
      setShowBill(false);
      setErrorMsg(`เรียกเก็บเงินไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setClosing(false);
    }
  }

  // ---------- หน้าเต็มจอแบบต่างๆ ----------
  if (status === 'loading') {
    return <div style={s.full}><p style={{ fontSize: 24 }}>กำลังโหลด...</p></div>;
  }
  if (status === 'closedTable') {
    return (
      <div style={s.full}>
        <h1 style={{ fontSize: 30, lineHeight: 1.4 }}>โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน</h1>
      </div>
    );
  }
  if (status === 'finished') {
    return (
      <div style={s.full}>
        <h1 style={{ fontSize: 36 }}>ขอบคุณที่ใช้บริการ</h1>
        <p style={{ fontSize: 22 }}>สุกี้ผีน้อย</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={s.full}>
        <h1 style={{ fontSize: 26 }}>เกิดข้อผิดพลาด กรุณาแจ้งพนักงาน</h1>
        <p style={{ fontSize: 16, color: '#777' }}>{errorMsg}</p>
      </div>
    );
  }

  // ---------- หน้าสั่งอาหาร ----------
  const visibleItems = items.filter((i) => i.category_id === activeCat);
  const cartQty = cart.reduce((sum, x) => sum + x.quantity, 0);
  const total = session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE;

  return (
    <div style={s.page}>
      {notice && <div style={s.toast}>{notice}</div>}

      <header style={s.header}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>สุกี้ผีน้อย</div>
          <div style={{ fontSize: 16 }}>โต๊ะ {tableNumber}</div>
        </div>
        <button type="button" style={s.billBtn} onClick={() => setShowBill(true)}>
          เรียกเก็บเงิน
        </button>
      </header>

      <nav style={s.tabs}>
        {categories.map((cat) => (
          <button key={cat.id} type="button" style={s.tab(cat.id === activeCat)} onClick={() => setActiveCat(cat.id)}>
            {cat.name}
          </button>
        ))}
      </nav>

      {errorMsg && <p style={{ ...s.error, padding: '0 14px' }}>{errorMsg}</p>}

      <section>
        {visibleItems.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 18, marginTop: 30 }}>ยังไม่มีเมนูในหมวดนี้</p>
        )}
        {visibleItems.map((item) => {
          const inCart = cart.find((x) => x.id === item.id);
          return (
            <div key={item.id} style={s.item}>
              <span style={s.itemName}>
                {item.name}
                {inCart && <span style={s.badge}>×{inCart.quantity}</span>}
              </span>
              <button type="button" style={s.plus} onClick={() => addToCart(item)} aria-label={`เพิ่ม ${item.name}`}>
                +
              </button>
            </div>
          );
        })}
      </section>

      {cart.length > 0 && (
        <div style={s.cartBar}>
          <button type="button" style={s.cartBtn} onClick={() => setShowCart(true)}>
            🛒 ตะกร้า {cart.length}/{MAX_ITEMS_PER_ORDER} รายการ ({cartQty} ที่)
          </button>
        </div>
      )}

      {showCart && (
        <div style={s.overlay} onClick={() => setShowCart(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 26, margin: '0 0 8px' }}>ตะกร้าของคุณ</h2>
            {cart.map((x) => (
              <div key={x.id} style={s.row}>
                <span style={{ flex: 1 }}>{x.name}</span>
                <button type="button" style={s.step} onClick={() => changeQty(x.id, -1)}>−</button>
                <b style={{ minWidth: 24, textAlign: 'center' }}>{x.quantity}</b>
                <button type="button" style={s.step} onClick={() => changeQty(x.id, 1)}>+</button>
              </div>
            ))}
            {errorMsg && <p style={s.error}>{errorMsg}</p>}
            <button
              type="button"
              style={{ ...s.primaryBtn, opacity: sending ? 0.6 : 1 }}
              disabled={sending}
              onClick={sendOrder}
            >
              {sending ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
            </button>
            <button
              type="button"
              style={{ ...s.primaryBtn, background: '#9e9e9e', marginTop: 10 }}
              onClick={() => setShowCart(false)}
            >
              สั่งเพิ่ม
            </button>
          </div>
        </div>
      )}

      {showBill && (
        <div style={{ ...s.overlay, alignItems: 'center' }}>
          <div style={s.modal}>
            <h2 style={{ fontSize: 26, margin: '0 0 12px' }}>เรียกเก็บเงิน</h2>
            <div style={s.row}>
              <span>ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE}</span>
              <b>{(session.adult_count * ADULT_PRICE).toLocaleString()}</b>
            </div>
            <div style={s.row}>
              <span>เด็ก {session.child_count} × {CHILD_PRICE}</span>
              <b>{(session.child_count * CHILD_PRICE).toLocaleString()}</b>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: c.primary, margin: '16px 0' }}>
              ยอดที่ต้องจ่าย {total.toLocaleString()} บาท
            </p>
            <p style={{ fontSize: 16, color: '#777', margin: '0 0 14px' }}>
              เมื่อยืนยันแล้วจะสั่งอาหารเพิ่มไม่ได้
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={s.grayBtn} disabled={closing} onClick={() => setShowBill(false)}>
                ยกเลิก
              </button>
              <button type="button" style={{ ...s.redBtn, opacity: closing ? 0.6 : 1 }} disabled={closing} onClick={confirmBill}>
                {closing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
