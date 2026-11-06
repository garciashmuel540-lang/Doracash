import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/chat-ia')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { mensaje, contexto } = await request.json()
          const apiKey = process.env.GEMINI_API_KEY
          if (!apiKey) throw new Error("Falta GEMINI_API_KEY")

          const prompt = `Eres un asistente financiero personal. Responde en español de forma concisa y amigable.
          
AQUÍ ESTÁN LOS DATOS REALES DEL USUARIO:
- Dinero libre esta quincena: C$${contexto?.libre || 0}
- Gastos actuales: C$${contexto?.gastos || 0}
- Ahorro total en metas: C$${contexto?.ahorro || 0}
- Metas: ${contexto?.metas || 'Ninguna'}

Mensaje del usuario: "${mensaje}"`

          // Modelo rápido y ligero de la familia Gemini 3.x
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
          )

          const data = await response.json()
          if (!response.ok) throw new Error(JSON.stringify(data.error))

          const textoRespuesta = data.candidates[0].content.parts[0].text

          return new Response(JSON.stringify({ ok: true, respuesta: textoRespuesta }), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error: any) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
