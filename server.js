const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// WICHTIG: Body-Parser NUR für Nicht-Streaming-Routen
// Für die Proxy-Route parsen wir den Body manuell

// Statische Dateien
app.use(express.static(path.join(__dirname, 'public')));

// Proxy für Groq API
app.use('/api/groq', async (req, res) => {
    try {
        const targetUrl = 'https://api.groq.com/openai/v1' + req.url.replace('/api/groq', '');
        
        // Body sammeln (manuell parsen)
        let body = null;
        if (req.method !== 'GET' && req.headers['content-type']?.includes('application/json')) {
            body = await new Promise((resolve) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(null);
                    }
                });
            });
        }

        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            }
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Streaming-Antworten direkt durchleiten
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(decoder.decode(value, { stream: true }));
                }
            } catch (e) {
                console.error('Stream error:', e);
            }
            res.end();
            return;
        }

        // Nicht-Streaming-Antworten
        if (contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const blob = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType);
            res.status(response.status).send(Buffer.from(blob));
        }

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`API-Key vorhanden: ${GROQ_API_KEY ? '✅ Ja' : '❌ Nein'}`);
});
