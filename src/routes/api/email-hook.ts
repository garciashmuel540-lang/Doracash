import { createFileRoute } from '@tanstack/react-router'
import { GoogleGenAI } from '@google/genai'



// Función auxiliar para esperar
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const Route = createFileRoute('/api/email-hook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
          const body = await request.json()
          const emailText = body.text || body.html || JSON.stringify(body)

          const prompt = `Analiza este correo de alerta bancaria y extrae:
1. Monto (solo el número, sin símbolos)
2. Fecha (formato YYYY-MM-DD)
3. Tipo: "ingreso" si es depósito, "gasto" si es retiro/compra
4. Categoría sugerida (Comida, Transporte, Hogar, Salario, etc.)

Responde SOLO con un JSON válido, sin texto adicional:
{"monto": 0, "fecha": "YYYY-MM-DD", "tipo": "ingreso", "categoria": "..."}

Correo:
${emailText}`

          // Intentar hasta 3 veces con espera creciente
          let interaction
          let ultimoError
          for (let intento = 1; intento <= 3; intento++) {
            try {
              interaction = await ai.interactions.create({
                model: 'gemini-3.8-flash',
                input: prompt,
              })
              break // Si funciona, salimos del bucle
            } catch (error: any) {
              ultimoError = error
              const mensaje = String(error)
              // Solo reintentar si es 503 (saturación) o 429 (límite de tasa)
              if (mensaje.includes('503') || mensaje.includes('429')) {
                const espera = intento * 2000 // 2s, 4s, 6s
                console.log(`[email-hook] Intento ${intento} falló por saturación. Esperando ${espera}ms...`)
                await sleep(espera)
              } else {
                throw error // Si es otro error, no reintentar
              }
            }
          }

          if (!interaction) {
            throw ultimoError || new Error('Gemini no respondió tras 3 intentos')
          }

          const resultado = JSON.parse(interaction.output_text || '{}')
          console.log('[email-hook] Transacción clasificada:', resultado)

          return new Response(JSON.stringify({ ok: true, data: resultado }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error('[email-hook] Error final:', error)
          return new Response(JSON.stringify({ ok: false, error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
})
