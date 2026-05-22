# Nobi Skill — Setup Guide

## 1. ติดตั้ง dependencies

```bash
cd "Nobi Skill"
npm install
```

## 2. ตั้งค่า Environment Variables

```bash
cp .env.local.example .env.local
```

แล้วแก้ไข `.env.local` ใส่ค่า Supabase ของคุณ:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. สร้าง Database Schema

เปิด Supabase Dashboard → SQL Editor แล้วรัน:

```
supabase/migrations/001_initial.sql
```

## 4. รัน dev server

```bash
npm run dev
```

เปิดที่ http://localhost:3000

---

## โครงสร้างหน้า

| Route | หน้า |
|-------|------|
| `/setup` | สร้างโปรไฟล์ (ชื่อเล่น + อายุ + ตัวละคร) |
| `/assessment` | แบบทดสอบหาระดับ 20 ข้อ (Adaptive) |
| `/practice` | แบบฝึกหัดรายวัน (กำลังพัฒนา) |

## Flow ของระบบ

```
เด็กเข้าครั้งแรก → /setup → /assessment → /practice
เด็กที่มีโปรไฟล์แล้ว → /practice (แบบฝึกวันนี้)
```

## Levels (1-10)

| Level | ชื่อ | ประเภทโจทย์ |
|-------|------|------------|
| 1 | นักคณิตน้อย | บวก 1 หลัก ไม่มีทด (1+2) |
| 2 | นักคณิตหัดใหม่ | บวก 1 หลัก มีทด (5+7) |
| 3 | กำลังเติบโต | 2+1 หลัก ไม่มีทด (23+4) |
| 4 | มือฉมัง | 2+1 หลัก มีทด (28+5) |
| 5 | เก่ง | 2+2 หลัก ไม่มีทด (23+45) |
| 6 | ขั้นสูง | 2+2 หลัก มีทด (37+45) |
| 7 | มืออาชีพ | 3+2 หลัก (123+45) |
| 8 | ระดับเซียน | 3+3 หลัก ไม่มีทด |
| 9 | ระดับแชมป์ | 3+3 หลัก มีทด |
| 10 | อัจฉริยะคณิต | 4+3 หลัก ความเร็วสูง |
