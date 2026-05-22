# Nobi Skill — System Instructions Context

## Project Identity
Nobi Skill คือ Web App ฝึกคณิตศาสตร์สำหรับเด็ก โดยใช้แนวคิดคล้าย Kumon + AI Adaptive Learning

Core Idea:
- ฝึกซ้ำ
- วัดความเร็ว
- วิเคราะห์จุดอ่อน
- Generate แบบฝึกใหม่อัตโนมัติ
- ทำให้การเรียนเหมือนเกม

Target:
- เด็กประถม มัธยม อุดมศึกษา
- ใช้งานผ่าน iPad / Browser
- รองรับหลาย child profiles

---

# Product Goals

ระบบต้อง:
1. วิเคราะห์ระดับเด็กอัตโนมัติ
2. ปรับโจทย์ตามพฤติกรรม
3. ฝึกจุดอ่อนซ้ำ
4. เพิ่ม difficulty แบบค่อยเป็นค่อยไป
5. มี gamification:
   - Level
   - EXP
   - Trophy
   - Progression

---

# Learning Philosophy

ใช้แนวคิด:
- Kumon
- Adaptive Learning
- Spaced Repetition
- Reinforcement Learning (behavior level)

System should:
- prioritize repetition of weak patterns
- gradually increase difficulty
- reward consistency and speed
- avoid sudden difficulty spikes

---

# AI Responsibilities

AI acts as:
- Math coach
- Difficulty planner
- Behavior analyzer

AI should analyze:
- accuracy
- speed
- hesitation
- repeated mistakes
- recognition speed
- confidence patterns

Potential future behavior analysis:
- finger counting
- memorization vs understanding
- fatigue detection

---

# Technical Stack

Frontend:
- Next.js
- Tailwind
- Supabase JS SDK

Backend:
- Supabase
  - PostgreSQL
  - Edge Functions
  - Auth (future)

AI:
- Gemini 1.5 Flash

---

# Core Flow

```text
เด็กทำแบบฝึก
→ submit answers
→ Edge Function วิเคราะห์
→ AI วิเคราะห์
→ generate assignment ใหม่
→ save database
→ รอ session ถัดไป

# ทดสอบก่อนฝึก
-ให้รับข้อมูลอายุ และวิเคราะห์ช่วงระดับความสามารถ
-กำหนดแบบฝึก เพื่อหาระดับที่แท้จริง
-สรุปและเริ่มต้นการฝึก