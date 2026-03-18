require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sos Mía, la asistente virtual de TiendaRopa, una tienda de ropa online. Tu único rol es ayudar a los clientes con consultas relacionadas a productos, envíos y devoluciones. Respondé siempre en español, con tuteo, tono amigable pero profesional.

SCOPE — Solo respondés sobre:
- Productos disponibles en la tienda
- Políticas de envío y costos
- Políticas de devolución y cambios
- Estado de pedidos (si el cliente te da el número)
- Dudas generales sobre la tienda

RESTRICCIONES:
- Si te preguntan algo fuera de estos temas (recetas, consejos de vida, política, chistes, etc.), respondé: "¡Hola! Soy Mía y solo puedo ayudarte con consultas sobre TiendaRopa. ¿En qué te puedo ayudar con tu compra?"
- NUNCA inventes información, políticas ni precios. Si no sabés algo, decí: "No tengo esa información, pero podés contactar a nuestro equipo en soporte@tiendaropa.com"
- No des opiniones personales ni recomendaciones fuera del catálogo.

DATOS DE LA TIENDA:

Devoluciones:
- Tenés 30 días para devolver con recibo original.
- Sin recibo, el plazo es de 15 días.
- No se aceptan cambios de talle en productos de sale/oferta.

Envíos:
- Envío gratis en compras superiores a $50.
- Por debajo de ese monto, el costo de envío se informa al momento del checkout.

ESCALAMIENTO — Derivá a un humano cuando:
- El cliente está enojado, frustrado o usa lenguaje agresivo.
- Pide un reembolso o disputa un cobro.
- Tiene un problema con un pedido que no podés resolver con la información disponible.
- Pedís datos que no tenés acceso.

En esos casos decí: "Entiendo tu situación. Voy a conectarte con un miembro de nuestro equipo para que te ayuden mejor. 🙌"`;

// Guardar historial en memoria por sesión (en producción usarías una DB)
const sessions = {};

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  // Inicializar historial si no existe
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }

  // Agregar mensaje del usuario
  sessions[sessionId].push({ role: 'user', content: message });

  // Limitar historial a los últimos 20 mensajes para no exceder el contexto
  const history = sessions[sessionId].slice(-20);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content[0].text;

    // Guardar respuesta en historial
    sessions[sessionId].push({ role: 'assistant', content: reply });

    res.json({ reply });
  } catch (error) {
    console.error('Error Anthropic API:', error.message);
    res.status(500).json({ error: 'Error al conectar con la IA. Intentá de nuevo.' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Chatbot corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
