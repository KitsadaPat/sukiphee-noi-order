# สุกี้ผีน้อย — ระบบสั่งอาหารร้านบุฟเฟต์

## Stack
- Next.js (เวอร์ชันล่าสุด) App Router — **JavaScript เท่านั้น ไม่ใช้ TypeScript**
- Deploy บน Vercel, ฐานข้อมูล Supabase (`lib/supabaseClient.js`)
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (ตั้งใน `.env.local` ตอน dev และใน Vercel Project Settings ตอน deploy)

## หน้าที่วางแผนไว้
- `/` หน้าแรก (ทดสอบ deploy)
- `/generate-qr` สร้าง QR ของโต๊ะ
- `/kitchen` หน้าครัว
- หน้าสั่งอาหารของลูกค้า (Dynamic Route — ขั้นตอนถัดไป)

## โครงสร้างตาราง Supabase (มีอยู่แล้ว ไม่ต้องสร้างใหม่ ใช้อ้างอิงทั้งโปรเจกต์)
- `sessions` (id, table_number, adult_count, child_count, status, created_at)
- `menu_categories` (id, name, sort_order)
- `menu_items` (id, category_id, name)
- `orders` (id, session_id, table_number, items [jsonb], status, created_at)

## กฎสำคัญ: params ของ Dynamic Route เป็น Promise
ใน Next.js เวอร์ชันล่าสุด `params` (และ `searchParams`) ของ Dynamic Route เป็น **Promise**
ต้อง unwrap เสมอ:

```js
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  const { sessionId } = use(params); // unwrap ด้วย use() จาก React
  // ...
}
```

- Client Component (`'use client'`): ใช้ `use(params)` จาก React ตามตัวอย่างด้านบน
- Server Component (async function): `use()` ก็ใช้ได้ แต่ที่นิยมคือ `const { sessionId } = await params;`
- ห้ามอ่าน `params.sessionId` ตรงๆ

## หมายเหตุอื่น
- ห้าม commit `node_modules` และ `.env.local`
- ใช้ภาษาไทยใน UI ทั้งหมด
