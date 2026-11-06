import { createFileRoute } from '@tanstack/react-router'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const Route = createFileRoute('/api/parse-expense')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { texto } = await request.json()
          if (!texto || typeof texto !== 'string') {
            return new Response(JSON.stringify({ ok: false, error: 'Falta el campo "texto"' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const hoy = new Date().toISOString().slice(0, 10)

          const prompt = `Eres un asistente de finanzas personales. Hoy es ${hoy}.
Extrae los datos del siguiente gasto o ingreso escrito en lenguaje natural y responde SOLO con un JSON válido (sin texto adicional, sin markdown):

{"monto": number, "tipo": "gasto" | "ingreso", "categoria": string, "fecha": "YYYY-MM-DD", "descripcion": string}

Reglas:
- "monto" es un número positivo, sin símbolos ni comas.
- "tipo" es "gasto" si es una compra/pago, "ingreso" si es un depósito/salario.
- "categoria" elige una de: Comida, Transporte, Hogar, Salud, Ocio, Servicios, Salario, Otros.
- "fecha": si dice "hoy" usa ${hoy}; "ayer" resta 1 día; si no se menciona, usa ${hoy}.
- "descripcion": resumen corto (máx 60 caracteres).

Texto del usuario:
${texto}`

          let interaction
          let ultimoError
          for (let intento = 1; intento <= 3; intento++) {
            try {
              interaction = await ai.interactions.create({
                model: 'gemini-3.8-flash',
                input: prompt,
              })
              break
            } catch (error: any) {
              ultimoError = error
              const msg = String(error)
              if (msg.includes('503') || msg.includes('429')) {
                await sleep(intento * 2000)
              } else {
                throw error
              }
            }
          }

          if (!interaction) throw ultimoError || new Error('Gemini no respondió')

          // Limpia posibles ```json ... ``` del modelo
          const raw = interaction.output_text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
          const data = JSON.parse(raw)

          return new Response(JSON.stringify({ ok: true, data }), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[parse-expense] Error:', error)
          return new Response(JSON.stringify({ ok: false, error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
