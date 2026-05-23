# Nobi Skill — Supabase + Gemini AI Setup Guide

## ขั้นตอนที่ 1: สร้าง Supabase Project

1. ไปที่ https://supabase.com และล็อกอิน
2. คลิก "New project"
3. ตั้งชื่อ project: `nobi-skill`
4. เลือก region ใกล้บ้าน (เช่น Singapore)
5. กด "Create new project" รอสักครู่

## ขั้นตอนที่ 2: รัน Database Migration

1. เปิด Supabase Dashboard → **SQL Editor**
2. เปิดไฟล์ `supabase/migrations/001_initial.sql`
3. Copy ทั้งหมด → วางใน SQL Editor → กด **Run**

## ขั้นตอนที่ 3: ตั้งค���า Environment Variables

1. ใน Supabase Dashboard → **Settings** → **API**
2. Copy **Project URL** และ **anon public** key
3. Copy ไฟล์ `.env.local.example` → เปลี่ยนชื่อเป็น `.env.local`
4. ใส่ค่าที่ copy มา:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

## ขั้นตอนที่ 4: ติดตั้ง Supabase CLI

```powershell
# Windows PowerShell (run as Admin)
winget install Supabase.CLI
# หรือ
scoop install supabase
```

## ขั้นตอนที่ 5: Deploy Edge Function

```powershell
# เปิด PowerShell ใน folder โปรเจค
cd "D:\OneDrive\Project\Claude\Nobi Skill\Nobi Skill"

# ล็อกอิน Supabase CLI
supabase login

# Link กับ project (หา project-ref ใน Supabase Dashboard URL)
supabase link --project-ref <your-project-ref>

# Deploy Edge Function
supabase functions deploy analyze-session --project-ref <your-project-ref>
```

## ขั้นตอนที่ 6: ตั้งค่า Gemini API Key

1. ไปที่ https://aistudio.google.com/app/apikey
2. สร้าง API key ใหม่
3. ตั้งเป็น Supabase Secret:

```powershell
supabase secrets set GEMINI_API_KEY=AIza... --project-ref <your-project-ref>
```

## ขั้นตอนที่ 7: ทดสอบ

รัน dev server แล้วทำ practice session → หน้า result ควรโชว์ "🤖 Nobi AI วิเคราะห์"

```powershell
npm run dev
```

## หมายเหตุ

- ถ้าไม่ตั้งค่า Supabase แอปยังใช้ได้ปกติ (ไม่มี AI feedback แต่ทุกอย่างอื่นทำงานได้)
- Edge Function อยู่ที่: `supabase/functions/analyze-session/index.ts`
- GitHub Pages ใช้ localStorage ล้วน ไม่ต้องการ Supabase สำหรับ core features
