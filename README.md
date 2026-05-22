# Nobi Skill — ฝึกคณิตสนุก! 🧮✨

Web App ฝึกคณิตศาสตร์สำหรับเด็ก โดยใช้แนวคิดแบบ **Kumon + AI Adaptive Learning** — ฝึกซ้ำ วัดความเร็ว วิเคราะห์จุดอ่อน และสร้างแบบฝึกใหม่อัตโนมัติ ทำให้การเรียนเหมือนเล่นเกม

> A gamified, adaptive math-practice web app for kids. Inspired by Kumon-style repetition with an AI coach that measures speed, finds weak spots, and generates new exercises automatically.

---

## ✨ Features

- **โปรไฟล์เด็ก (Child profiles)** — ชื่อเล่น, อายุ, เลือกตัวละคร (12 avatars)
- **แบบทดสอบหาระดับ (Adaptive assessment)** — 20 ข้อ ปรับความยากตามคำตอบแบบ real-time
- **4 การดำเนินการ (＋ − × ÷)** — เลือกฝึก บวก / ลบ / คูณ / หาร ได้ แต่ละแบบมี 10 ระดับ และโจทย์คุมไม่ให้คำตอบติดลบหรือเกิน 5 หลัก
- **ฝึกจุดอ่อนซ้ำ (Adaptive weak-spot engine)** — ระบบจดจำว่าเด็กพลาด/ช้าตรง pattern ไหน (เช่น การทด, การยืม, เลข 3 หลัก) แล้วดึงจุดอ่อนนั้นมาให้ฝึกซ้ำบ่อยขึ้นแบบอัตโนมัติ แยกตามการดำเนินการ ทำงานฝั่ง client ทั้งหมด (localStorage)
- **10 ระดับความสามารถ** — ตั้งแต่บวกเลข 1 หลัก จนถึงบวกเลขหลายหลักความเร็วสูง
- **ระบบถ้วยรางวัล (Trophies)** — 12 ถ้วยรางวัลปลดล็อกตามความสำเร็จ (ตอบถูกสะสม, คะแนนเต็ม, streak, ครบทุกการดำเนินการ ฯลฯ) + หน้ารวมถ้วยรางวัล
- **Gamification** — Level, EXP, ตัวละคร, การให้กำลังใจ, แอนิเมชันสนุก ๆ
- **ออกแบบสำหรับ iPad / Touch** — มี numpad เสมือน เหมาะกับการแตะหน้าจอ
- **รองรับภาษาไทย** เต็มรูปแบบ

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3, Framer Motion |
| Backend | Supabase (PostgreSQL, Edge Functions) |
| AI | Gemini 1.5 Flash (สำหรับวิเคราะห์พฤติกรรม + สร้างแบบฝึก) |

## 🚀 Getting Started

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

```bash
cp .env.local.example .env.local
```

แล้วแก้ไข `.env.local` ใส่ค่า Supabase ของคุณ:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. สร้าง Database Schema

เปิด Supabase Dashboard → SQL Editor แล้วรันไฟล์ `supabase/migrations/001_initial.sql`

> หมายเหตุ: เวอร์ชันปัจจุบันยังเก็บข้อมูลโปรไฟล์/ผลทดสอบไว้ใน `localStorage` ของเบราว์เซอร์ จึงสามารถทดลองใช้งานได้ทันทีโดยยังไม่ต้องตั้งค่า Supabase

### 4. รัน dev server

```bash
npm run dev
```

เปิดที่ [http://localhost:3000](http://localhost:3000)

## 📂 Project Structure

```
Nobi Skill/
├── src/
│   ├── app/
│   │   ├── page.tsx           # หน้าแรก — redirect ตามสถานะผู้ใช้
│   │   ├── setup/             # สร้างโปรไฟล์ (ชื่อ + อายุ + ตัวละคร)
│   │   ├── assessment/        # แบบทดสอบหาระดับ 20 ข้อ (Adaptive)
│   │   ├── practice/          # แบบฝึกหัดรายวัน (กำลังพัฒนา)
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── types.ts           # Type definitions + LEVEL_META
│       ├── assessment.ts      # Problem generator + adaptive logic
│       ├── avatars.ts         # รายการตัวละคร
│       └── supabase.ts        # Supabase client
├── supabase/
│   └── migrations/001_initial.sql
├── public/manifest.json
└── ...config files
```

## 🗺 Routes

| Route | หน้า |
|-------|------|
| `/setup` | สร้างโปรไฟล์ (ชื่อเล่น + อายุ + ตัวละคร) |
| `/assessment` | แบบทดสอบหาระดับ 20 ข้อ (Adaptive) |
| `/practice` | แบบฝึกหัดรายวัน (กำลังพัฒนา) |

**Flow:** เด็กเข้าครั้งแรก → `/setup` → `/assessment` → `/practice`

## 📊 Levels (1–10)

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

## 🧠 How the Adaptive Engine Works

**ตอนทดสอบหาระดับ (`/assessment`)**

- **เริ่มต้น** ที่ระดับตามช่วงอายุ (`getStartingLevel`)
- **เลื่อนขึ้น** เมื่อตอบถูก 3 ข้อติด และเร็วอย่างน้อย 2 ข้อ
- **เลื่อนลง** เมื่อตอบผิด 2 ข้อติดกัน
- **สรุประดับสุดท้าย** จากระดับสูงสุดที่ทำได้แม่นยำ ≥ 70%
- ผลทดสอบจะถูก **seed** เข้าระบบจุดอ่อนทันที เพื่อให้การฝึกครั้งแรกตรงจุด

**ตอนฝึก (`/practice`) — Weak-spot repetition** (`src/lib/adaptive.ts` + `src/lib/problems.ts`)

- เด็กเลือกการดำเนินการก่อนฝึก (＋ − × ÷) แต่ละแบบมี generator เฉพาะ 10 ระดับ
- โจทย์ทุกข้อถูกติด **tag** แบบ op-namespaced เช่น `add-carry`, `sub-borrow`, `mul-d2`, `div-d2`
- ระบบเก็บสถิติต่อ tag (ความแม่นยำ, เวลาเฉลี่ย, จำนวนผิดล่าสุด) แล้วคำนวณ `weaknessScore`
- เวลาสร้างโจทย์ ~55% ของข้อจะถูกดึงมาจาก **จุดอ่อนที่หนักที่สุดของการดำเนินการนั้น** (แสดง badge "🎯 ทบทวนจุดอ่อน")
- ปรับตัวทั้ง **ภายใน session** (โจทย์ถัดไปตอบสนองทันที) และ **ข้าม session** (บันทึกใน localStorage)
- หน้า Dashboard แสดง "จุดอ่อนที่กำลังฝึก" 3 อันดับแรกของการดำเนินการที่เลือก พร้อม % ความแม่นยำ

**ถ้วยรางวัล (`/practice` → ถ้วยรางวัล)** (`src/lib/trophies.ts`)

- เก็บสถิติสะสมตลอดชีพ (sessions, ตอบถูก, perfect, fast, streak, ops ที่ลอง) ใน localStorage
- ประเมิน 12 ถ้วยหลังจบทุก session — ถ้าปลดล็อกใหม่จะเด้งแจ้งบนหน้าผลการฝึก

## 📝 Roadmap

- [x] ฝึกจุดอ่อนซ้ำอัตโนมัติ (deterministic weak-spot engine, client-side)
- [x] เพิ่มการดำเนินการ ลบ / คูณ / หาร (＋ − × ÷, อย่างละ 10 ระดับ)
- [x] ระบบถ้วยรางวัล (Trophies) — 12 ถ้วย ปลดล็อกตามความสำเร็จ
- [ ] แบบฝึกหัดรายวันที่ AI สร้างให้ (Gemini) ตามจุดอ่อน
- [ ] บันทึกข้อมูลขึ้น Supabase + รองรับหลายโปรไฟล์บนอุปกรณ์เดียว
- [ ] Streak / EXP เต็มรูปแบบ (UI ลึกขึ้น)
- [ ] Authentication (ผู้ปกครอง)
- [ ] วิเคราะห์พฤติกรรมขั้นสูง (fatigue, finger counting)

---

Made with ❤️ for young learners.
