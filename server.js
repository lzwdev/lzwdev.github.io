const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Key sicher im Server gespeichert
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Proxy für Chat Completions (Streaming)
app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(response.status).json(error);
        }

        // Streaming weiterleiten
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
        }
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proxy für Models-Liste
app.get('/api/models', async (req, res) => {
    try {
        const response = await fetch(`${GROQ_API_BASE}/models`, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proxy für TTS Audio
app.post('/api/audio/speech', async (req, res) => {
    try {
        const response = await fetch(`${GROQ_API_BASE}/audio/speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(response.status).json(error);
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'audio/wav');
        res.send(Buffer.from(buffer));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
