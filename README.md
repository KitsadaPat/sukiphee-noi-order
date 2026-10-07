# สุกี้ผีน้อย

ระบบสั่งอาหารร้านบุฟเฟต์ — Next.js (App Router, JavaScript) + Supabase, deploy บน Vercel

## เริ่มใช้งาน
```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่า Supabase จริง
npm run dev
```

## Deploy บน Vercel
1. push โค้ดขึ้น GitHub แล้ว Import เข้า Vercel
2. ตั้ง Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

ดูกฎและโครงสร้างตารางของโปรเจกต์ใน `CLAUDE.md`
(สำคัญ: `params` ของ Dynamic Route เป็น Promise ต้อง unwrap ด้วย `use()`)
