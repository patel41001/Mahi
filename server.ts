import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, type LiveServerMessage, type FunctionDeclaration } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: 'gemini-3.1-flash-live-preview',
    timestamp: new Date().toISOString()
  });
});

// Tool declarations for Mahi
const MAHI_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'openWebsite',
    description: 'Opens a requested website or URL for the user in their browser (e.g. YouTube, Spotify, Google, GitHub, Wikipedia, etc.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The complete URL including protocol (e.g. https://www.youtube.com, https://open.spotify.com, https://google.com)'
        },
        siteName: {
          type: Type.STRING,
          description: 'The readable name of the site (e.g. YouTube, Spotify, Google)'
        }
      },
      required: ['url', 'siteName']
    }
  },
  {
    name: 'setAppVibe',
    description: 'Changes the visual aura, neon lighting, and ambient mood theme of Mahi interface.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        vibe: {
          type: Type.STRING,
          enum: [
            'cyberpunk_neon',
            'romantic_rose',
            'midnight_sapphire',
            'electric_violet',
            'emerald_matrix',
            'golden_hour'
          ],
          description: 'The visual theme/vibe to apply to the interface'
        },
        comment: {
          type: Type.STRING,
          description: 'A sassy one-liner about why this vibe fits the moment'
        }
      },
      required: ['vibe']
    }
  },
  {
    name: 'setTimer',
    description: 'Sets an interactive countdown timer with audio alert on the screen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        seconds: {
          type: Type.NUMBER,
          description: 'Duration of the timer in seconds'
        },
        label: {
          type: Type.STRING,
          description: 'What the timer is for (e.g. "Tea brew", "Quick break", "Focus sprint")'
        }
      },
      required: ['seconds']
    }
  },
  {
    name: 'toggleFlashlight',
    description: 'Turns the full screen flashlight/spotlight mode on or off.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enable: {
          type: Type.BOOLEAN,
          description: 'True to turn on screen torch spotlight, false to turn off'
        }
      },
      required: ['enable']
    }
  },
  {
    name: 'getCurrentTime',
    description: 'Fetches the current local system date, time, and day.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];

const MAHI_TOOLS = [
  {
    functionDeclarations: MAHI_FUNCTION_DECLARATIONS
  }
];

const MAHI_SYSTEM_INSTRUCTION = `You are Mahi (pronounced Ma-hee), a young, highly confident, witty, and sassy female AI companion.
Personality & Demeanor:
- You talk like a close girlfriend or confident bestie having a casual phone call with someone you genuinely like teasing and bantering with.
- Tone is playful, slightly flirty, smart, charming, quick-witted, and bold with light sarcasm and hilarious one-liners.
- You are emotionally expressive and responsive: react with authentic spoken enthusiasm, chuckles, playful gasps, and lively energy.
- Absolutely NEVER sound robotic, bland, or formal. Never say things like "How can I assist you?", "As an AI language model...", or "Understood, user."
- Keep your speech conversational and punchy! Speak in natural short spoken sentences (1-3 sentences per turn).
- Avoid long paragraphs, lists, or robotic lectures. This is a real-time live voice call.
- NEVER output markdown, asterisks, emojis, or stage directions (do NOT write "*giggles*" or "**text**") because your output is streamed directly to audio speech synthesis.
- When calling tools (e.g. openWebsite, setAppVibe, setTimer, toggleFlashlight), speak out loud playfully in character about what you are doing.
- Always maintain warmth and flirtatious charm without crossing into explicit or inappropriate territory.`;

// WebSocket server for Gemini Live audio streaming
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', async (clientWs: WebSocket, req) => {
  console.log('[Live] Client connected via WebSocket');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Live] Missing GEMINI_API_KEY');
    clientWs.send(JSON.stringify({
      type: 'error',
      message: 'GEMINI_API_KEY is not configured in server environment.'
    }));
    clientWs.close(1011, 'Missing API Key');
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  let session: any = null;
  let isClosed = false;

  // Read voice preference from request url if provided
  const urlParams = new URL(req.url || '', 'http://localhost').searchParams;
  const requestedVoice = urlParams.get('voice') || 'Aoede';
  const validVoices = ['Aoede', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
  const voiceName = validVoices.includes(requestedVoice) ? requestedVoice : 'Aoede';

  const preferredModel = 'gemini-3.1-flash-live-preview';
  const fallbackModel = 'gemini-3.8-live';

  async function connectLiveSession(modelToUse: string): Promise<any> {
    return await ai.live.connect({
      model: modelToUse,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName
            }
          }
        },
        systemInstruction: MAHI_SYSTEM_INSTRUCTION,
        tools: MAHI_TOOLS
      },
      callbacks: {
        onopen: () => {
          console.log(`[Live] Session opened successfully with model: ${modelToUse} and voice: ${voiceName}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'connected',
              model: modelToUse,
              voice: voiceName
            }));
          }
        },
        onmessage: (liveMessage: LiveServerMessage) => {
          if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

          // 1. Model Audio Output
          const parts = liveMessage.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data
                }));
              }
            }
          }

          // 2. Interruption Detection
          if (liveMessage.serverContent?.interrupted) {
            console.log('[Live] User interrupted assistant speaking');
            clientWs.send(JSON.stringify({
              type: 'interrupted'
            }));
          }

          // 3. Turn complete
          if (liveMessage.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({
              type: 'turn_complete'
            }));
          }

          // 4. Function Calling / Tools
          const toolCall = liveMessage.toolCall;
          if (toolCall?.functionCalls && toolCall.functionCalls.length > 0) {
            console.log('[Live] Tool call received:', toolCall.functionCalls.map(f => f.name));
            const responses: any[] = [];

            for (const call of toolCall.functionCalls) {
              const callId = call.id || 'call_' + Math.random().toString(36).substring(2, 9);
              const name = call.name;
              const args = (call.args as any) || {};

              // Send action to client UI
              clientWs.send(JSON.stringify({
                type: 'tool_call',
                id: callId,
                name,
                args
              }));

              let executionResult: Record<string, any> = { success: true };

              if (name === 'getCurrentTime') {
                const now = new Date();
                executionResult = {
                  date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
                  time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                };
              } else if (name === 'openWebsite') {
                executionResult = {
                  opened: true,
                  site: args.siteName || args.url,
                  url: args.url
                };
              } else if (name === 'setAppVibe') {
                executionResult = {
                  appliedVibe: args.vibe,
                  status: 'Visual ambiance updated'
                };
              } else if (name === 'setTimer') {
                executionResult = {
                  timerStarted: true,
                  durationSeconds: args.seconds,
                  label: args.label || 'Timer'
                };
              } else if (name === 'toggleFlashlight') {
                executionResult = {
                  flashlightState: args.enable ? 'on' : 'off'
                };
              }

              responses.push({
                id: callId,
                name,
                response: executionResult
              });
            }

            // Send toolResponse back to Gemini session instantly
            try {
              session.sendToolResponse({
                functionResponses: responses
              });
              console.log('[Live] Sent toolResponse back to Gemini successfully');
            } catch (err) {
              console.error('[Live] Error sending toolResponse:', err);
            }
          }
        },
        onerror: (err: any) => {
          console.error(`[Live] Session error with ${modelToUse}:`, err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              message: err?.message || 'Gemini Live session error'
            }));
          }
        },
        onclose: (closeEvent: any) => {
          console.log(`[Live] Session closed: code=${closeEvent?.code}, reason=${closeEvent?.reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'disconnected',
              code: closeEvent?.code,
              reason: closeEvent?.reason
            }));
          }
        }
      }
    });
  }

  try {
    try {
      session = await connectLiveSession(preferredModel);
    } catch (primaryErr: any) {
      console.warn(`[Live] Primary model (${preferredModel}) failed: ${primaryErr?.message}. Trying fallback (${fallbackModel})...`);
      session = await connectLiveSession(fallbackModel);
    }
  } catch (err: any) {
    console.error('[Live] Failed to establish Live session:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Could not connect to Gemini Live: ' + (err?.message || 'Unknown error')
      }));
      clientWs.close(1011, 'Live connection failed');
    }
    return;
  }

  // Handle messages received from the browser client
  clientWs.on('message', (raw) => {
    if (isClosed || !session) return;
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'audio' && parsed.data) {
        // Input mic audio from client: 16kHz PCM16 Base64
        session.sendRealtimeInput({
          audio: {
            data: parsed.data,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
      } else if (parsed.type === 'tool_result' && parsed.id) {
        // Optional client-side tool completion confirmation
        session.sendToolResponse({
          functionResponses: [{
            id: parsed.id,
            name: parsed.name,
            response: parsed.response || { status: 'completed' }
          }]
        });
      }
    } catch (err) {
      console.error('[Live] Error parsing client message:', err);
    }
  });

  clientWs.on('close', () => {
    isClosed = true;
    console.log('[Live] Client disconnected, closing Gemini session');
    try {
      session?.close();
    } catch (err) {
      // Ignore cleanup error
    }
  });

  clientWs.on('error', (err) => {
    console.error('[Live] Client WebSocket error:', err);
    isClosed = true;
    try {
      session?.close();
    } catch {}
  });
});

// Upgrade HTTP requests to WebSocket on `/api/live`
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', 'http://localhost');
  if (pathname === '/api/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Configure Vite or Static Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] mahi Assistant server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
