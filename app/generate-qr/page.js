'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const styles = {
  page: { maxWidth: 520, margin: '0 auto', padding: 20, fontSize: 22 },
  h1: { fontSize: 32, textAlign: 'center', margin: '8px 0 20px' },
  label: { display: 'block', fontSize: 22, fontWeight: 600, margin: '14px 0 6px' },
  input: {
    width: '100%', boxSizing: 'border-box', fontSize: 28, padding: '12px 14px',
    border: '2px solid #999', borderRadius: 10,
  },
  btn: {
    width: '100%', fontSize: 26, fontWeight: 700, padding: '16px', marginTop: 20,
    border: 'none', borderRadius: 12, color: '#fff', background: '#2e7d32', cursor: 'pointer',
  },
  btnSmall: {
    fontSize: 18, padding: '8px 14px', border: '2px solid #1565c0', borderRadius: 8,
    background: '#fff', color: '#1565c0', cursor: 'pointer', fontWeight: 600,
  },
  warn: {
    background: '#fff3e0', border: '4px solid #e65100', borderRadius: 12,
    padding: 18, marginTop: 20,
  },
  warnText: { fontSize: 26, fontWeight: 700, color: '#bf360c', margin: '0 0 14px' },
  btnWarn: {
    width: '100%', fontSize: 24, fontWeight: 700, padding: 14, border: 'none',
    borderRadius: 10, color: '#fff', background: '#d32f2f', cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50,
  },
  dialog: {
    background: '#fff', border: '5px solid #d32f2f', borderRadius: 14, padding: 22,
    maxWidth: 460, width: '100%',
  },
  error: { color: '#c62828', fontWeight: 600, marginTop: 14, fontSize: 20 },
  result: { textAlign: 'center', marginTop: 10 },
  url: { wordBreak: 'break-all', fontSize: 20, margin: '10px 0' },
};

function minutesSince(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export default function GenerateQrPage() {
  const [table, setTable] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [existing, setExisting] = useState(null); // เซสชันเก่าที่ยังเปิดอยู่
  const [showConfirm, setShowConfirm] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(0);

  const [created, setCreated] = useState(null); // { table, adults, children, url }
  const [copied, setCopied] = useState(false);

  async function handleOpenTable(e) {
    e.preventDefault();
    setError('');

    const t = parseInt(table, 10);
    const a = parseInt(adults || '0', 10);
    const c = parseInt(children || '0', 10);

    if (!Number.isInteger(t) || t <= 0) return setError('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
    if (!Number.isInteger(a) || a < 0 || !Number.isInteger(c) || c < 0)
      return setError('จำนวนคนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (a + c < 1) return setError('กรุณากรอกจำนวนลูกค้าอย่างน้อย 1 คน');

    setLoading(true);
    try {
      const { data: openRows, error: checkErr } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count, created_at')
        .eq('table_number', t)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);
      if (checkErr) throw checkErr;

      if (openRows && openRows.length > 0) {
        setExisting({ ...openRows[0], table_number: t });
        return;
      }

      const { error: insertErr } = await supabase.from('sessions').insert({
        table_number: t,
        adult_count: a,
        child_count: c,
        status: 'open',
      });
      if (insertErr) throw insertErr;

      setCreated({
        table: t,
        adults: a,
        children: c,
        url: `${window.location.origin}/order/${t}`,
      });
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    setMinutesOpen(minutesSince(existing.created_at));
    setShowConfirm(true);
  }

  async function confirmClose() {
    setError('');
    setLoading(true);
    try {
      // อัปเดตเฉพาะแถวนี้ และเฉพาะตอนที่ยังเป็น 'open' กันกดซ้ำซ้อน
      const { error: updErr } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .eq('status', 'open')
        .select('id');
      if (updErr) throw updErr;

      // ถ้าไม่มีแถวถูกอัปเดต แปลว่าถูกปิดไปแล้ว ถือว่าเรียบร้อย
      setShowConfirm(false);
      setExisting(null);
    } catch (err) {
      setShowConfirm(false);
      setError(`ปิดโต๊ะเดิมไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(created.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = created.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetAll() {
    setTable('');
    setAdults('');
    setChildren('');
    setCreated(null);
    setExisting(null);
    setShowConfirm(false);
    setError('');
  }

  // ---------- หน้าแสดงผล QR ----------
  if (created) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(created.url)}`;
    return (
      <main style={styles.page}>
        <h1 style={styles.h1}>เปิดโต๊ะสำเร็จ</h1>
        <div style={styles.result}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt={`QR โต๊ะ ${created.table}`} width={300} height={300} />
          <p style={{ fontSize: 26, fontWeight: 700, margin: '12px 0 4px' }}>
            โต๊ะ {created.table} · ผู้ใหญ่ {created.adults} · เด็ก {created.children}
          </p>
          <div style={styles.url}>
            {created.url}{' '}
            <button type="button" style={styles.btnSmall} onClick={copyLink}>
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>
          <button type="button" style={styles.btn} onClick={resetAll}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- ฟอร์ม ----------
  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>เปิดโต๊ะ</h1>

      <form onSubmit={handleOpenTable}>
        <label style={styles.label} htmlFor="table">เลขโต๊ะ</label>
        <input
          id="table" style={styles.input} type="number" inputMode="numeric" min="1"
          value={table} onChange={(e) => setTable(e.target.value)}
        />

        <label style={styles.label} htmlFor="adults">จำนวนผู้ใหญ่</label>
        <input
          id="adults" style={styles.input} type="number" inputMode="numeric" min="0"
          value={adults} onChange={(e) => setAdults(e.target.value)}
        />

        <label style={styles.label} htmlFor="children">จำนวนเด็ก</label>
        <input
          id="children" style={styles.input} type="number" inputMode="numeric" min="0"
          value={children} onChange={(e) => setChildren(e.target.value)}
        />

        <button type="submit" style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? 'กำลังดำเนินการ...' : 'เปิดโต๊ะ'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {existing && (
        <div style={styles.warn} role="alert">
          <p style={styles.warnText}>
            ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button type="button" style={styles.btnWarn} onClick={openConfirm}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {existing && showConfirm && (
        <div style={styles.overlay} role="dialog" aria-modal="true">
          <div style={styles.dialog}>
            <h2 style={{ fontSize: 28, color: '#b71c1c', margin: '0 0 12px' }}>
              ยืนยันปิดโต๊ะเดิม?
            </h2>
            <p style={{ margin: '6px 0' }}>โต๊ะ {existing.table_number}</p>
            <p style={{ margin: '6px 0' }}>
              ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
            </p>
            <p style={{ margin: '6px 0 18px' }}>เปิดมาแล้ว {minutesOpen} นาที</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button" disabled={loading} onClick={() => setShowConfirm(false)}
                style={{ ...styles.btnWarn, background: '#757575', flex: 1 }}
              >
                ยกเลิก
              </button>
              <button
                type="button" disabled={loading} onClick={confirmClose}
                style={{ ...styles.btnWarn, flex: 1, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
