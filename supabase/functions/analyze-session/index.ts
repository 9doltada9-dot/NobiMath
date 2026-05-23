// Supabase Edge Function: analyze-session
// Receives practice session data → calls Gemini 1.5 Flash → returns AIFeedback
// Deploy: supabase functions deploy analyze-session --project-ref <your-ref>
// Set secret: supabase secrets set GEMINI_API_KEY=<your-key> --project-ref <your-ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnswerRecord {
  problem: { a: number; b: number; answer: number; level: number; op?: string }
  userAnswer: number | null
  isCorrect: boolean
  timeSeconds: number
}

interface RequestBody {
  nickname: string
  age: number
  op: string
  level: number
  answers: AnswerRecord[]
}

interface AIFeedback {
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendedLevel: number
  encouragement: string
}

const OP_NAMES: Record<string, string> = {
  add: 'บวก (+)',
  sub: 'ลบ (−)',
  mul: 'คูณ (×)',
  div: 'หาร (÷)',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { nickname, age, op, level, answers } = body

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Derive stats
    const correctCount = answers.filter(a => a.isCorrect).length
    const totalCount = answers.length
    const accuracy = totalCount > 0 ? Math.round(correctCount / totalCount * 100) : 0
    const avgTime = totalCount > 0
      ? Math.round(answers.reduce((s, a) => s + a.timeSeconds, 0) / totalCount * 10) / 10
      : 0

    const wrongProblems = answers
      .filter(a => !a.isCorrect)
      .map(a => {
        const sym = a.problem.op === 'add' ? '+' : a.problem.op === 'sub' ? '−' : a.problem.op === 'mul' ? '×' : '÷'
        return `${a.problem.a}${sym}${a.problem.b} (ตอบ ${a.userAnswer ?? '?'} คำตอบจริง ${a.problem.answer})`
      })

    const slowProblems = answers
      .filter(a => a.isCorrect && a.timeSeconds > 15)
      .map(a => {
        const sym = a.problem.op === 'add' ? '+' : a.problem.op === 'sub' ? '−' : a.problem.op === 'mul' ? '×' : '÷'
        return `${a.problem.a}${sym}${a.problem.b} (${a.timeSeconds}s)`
      })

    // Determine recommended level
    let recommendedLevel = level
    if (accuracy >= 90 && avgTime < 8) recommendedLevel = Math.min(10, level + 1)
    else if (accuracy < 50) recommendedLevel = Math.max(1, level - 1)

    const prompt = `คุณเป็นครูสอนคณิตศาสตร์ที่เชี่ยวชาญ กำลังวิเคราะห์ผลการฝึกของเด็ก ให้ feedback เป็นภาษาไทย ใช้ภาษาที่เป็นมิตร เข้าใจง่าย เหมาะสำหรับเด็ก

ข้อมูลเด็ก:
- ชื่อ: ${nickname}
- อายุ: ${age} ปี
- operation ที่ฝึก: ${OP_NAMES[op] ?? op}
- ระดับปัจจุบัน: ${level}/10

ผลการฝึกครั้งนี้:
- ทำถูก: ${correctCount}/${totalCount} ข้อ (${accuracy}%)
- เวลาเฉลี่ย: ${avgTime} วินาที/ข้อ
- โจทย์ที่ตอบผิด: ${wrongProblems.length > 0 ? wrongProblems.join(', ') : 'ไม่มี (เก่งมาก!)'}
- โจทย์ที่ใช้เวลานาน: ${slowProblems.length > 0 ? slowProblems.join(', ') : 'ไม่มี'}

ระดับที่แนะนำต่อไป: ${recommendedLevel}

ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่น ตาม format นี้:
{
  "summary": "สรุปผลการฝึกสั้นๆ 1-2 ประโยค (ภาษาไทย ใช้ชื่อเด็กด้วย)",
  "strengths": ["จุดแข็ง 1 (ถ้ามี)", "จุดแข็ง 2 (ถ้ามี)"],
  "weaknesses": ["สิ่งที่ต้องปรับปรุง 1 (ถ้ามี)"],
  "recommendedLevel": ${recommendedLevel},
  "encouragement": "ข้อความให้กำลังใจสั้นๆ สนุกๆ สำหรับเด็ก 1 ประโยค (ภาษาไทย มี emoji)"
}`

    // Call Gemini 1.5 Flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`)
    }

    const geminiData = await geminiRes.json()
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON from Gemini response (sometimes wrapped in ```json ... ```)
    let feedback: AIFeedback
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON object found in response')
      feedback = JSON.parse(jsonMatch[0])
    } catch {
      // Fallback feedback if Gemini returns unexpected format
      feedback = {
        summary: `${nickname} ทำได้ ${correctCount}/${totalCount} ข้อ คิดเป็น ${accuracy}%`,
        strengths: accuracy >= 70 ? ['ทำได้ดีมาก!'] : [],
        weaknesses: accuracy < 70 ? ['ลองฝึกซ้ำเพิ่มเติม'] : [],
        recommendedLevel,
        encouragement: accuracy >= 90 ? '🌟 เก่งมากเลย!' : accuracy >= 70 ? '👍 ทำได้ดีนะ!' : '💪 สู้ต่อไปนะ!',
      }
    }

    return new Response(
      JSON.stringify({ feedback }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analyze-session] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
