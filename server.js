const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// API Key aus Umgebungsvariable (sicher!)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// Proxy für Groq API - schützt den API Key
app.use('/api/groq', async (req, res) => {
    try {
        const targetUrl = 'https://api.groq.com/openai/v1' + req.url.replace('/api/groq', '');
        
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        // Streaming support
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
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
            return;
        }

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Request Body Parser
app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
