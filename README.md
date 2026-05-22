# Nobi Skill — ฝึกคณิตสนุก! 🧮✨

Web App ฝึกคณิตศาสตร์สำหรับเด็ก โดยใช้แนวคิดแบบ **Kumon + AI Adaptive Learning** — ฝึกซ้ำ วัดความเร็ว วิเคราะห์จุดอ่อน และสร้างแบบฝึกใหม่อัตโนมัติ ทำให้การเรียนเหมือนเล่นเกม

> A gamified, adaptive math-practice web app for kids. Inspired by Kumon-style repetition with an AI coach that measures speed, finds weak spots, and generates new exercises automatically.

---

## ✨ Features

- **โปรไฟล์เด็ก (Child profiles)** — ชื่อเล่น, อายุ, เลือกตัวละคร (12 avatars)
- **แบบทดสอบหาระดับ (Adaptive assessment)** — 20 ข้อ ปรับความยากตามคำตอบแบบ real-time
- **10 ระดับความสามารถ** — ตั้งแต่บวกเลข 1 หลัก จนถึงบวกเลขหลายหลักความเร็วสูง
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

- **เริ่มต้น** ที่ระดับตามช่วงอายุ (`getStartingLevel`)
- **เลื่อนขึ้น** เมื่อตอบถูก 3 ข้อติด และเร็วอย่างน้อย 2 ข้อ
- **เลื่อนลง** เมื่อตอบผิด 2 ข้อติดกัน
- **สรุประดับสุดท้าย** จากระดับสูงสุดที่ทำได้แม่นยำ ≥ 70%

## 📝 Roadmap

- [ ] แบบฝึกหัดรายวันที่ AI สร้างให้ (Gemini) ตามจุดอ่อน
- [ ] บันทึกข้อมูลขึ้น Supabase + รองรับหลายโปรไฟล์บนอุปกรณ์เดียว
- [ ] ระบบ Trophy / Streak / EXP เต็มรูปแบบ
- [ ] Authentication (ผู้ปกครอง)
- [ ] วิเคราะห์พฤติกรรมขั้นสูง (fatigue, finger counting)

---

Made with ❤️ for young learners.
