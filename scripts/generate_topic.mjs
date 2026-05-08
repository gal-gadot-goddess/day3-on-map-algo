import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_KEY = process.env.POLLINATIONS_API_KEY;
const TOPIC_FILE = path.join(__dirname, '../src/data/current_topic.json');
const HISTORY_FILE = path.join(__dirname, '../topic_history.json');

const ALGOS = [
    'BFS', 'DFS', 'Dijkstra', 'A*', 'Greedy Best-First', 
    'Bidirectional BFS', 'Bidirectional Dijkstra', 'Bidirectional A*'
];

const NEON_PALETTES = ['Toxic Sludge', 'Cyberpunk', 'Joker', 'Fire & Ice', 'Hotrod', 'Magma'];

const CITIES = [
    { name: 'New York (SoHo)', lat: 40.7233, lng: -73.9988 },
    { name: 'London (Soho)', lat: 51.5134, lng: -0.1305 },
    { name: 'San Francisco (Market St)', lat: 37.7833, lng: -122.4167 },
    { name: 'Tokyo (Shibuya)', lat: 35.6580, lng: 139.7016 },
    { name: 'Paris (Marais)', lat: 48.8584, lng: 2.3551 },
    { name: 'Barcelona (Eixample)', lat: 41.3934, lng: 2.1643 },
    { name: 'Dubai (Downtown)', lat: 25.2048, lng: 55.2708 },
    { name: 'Mumbai (Colaba)', lat: 18.9218, lng: 72.8335 },
    { name: 'Rome (Trastevere)', lat: 41.8885, lng: 12.4707 },
    { name: 'Berlin (Mitte)', lat: 52.5200, lng: 13.4050 }
];

async function generateNewTopic() {
    console.log(`🤖 Generating new Real Map Algorithm topic...`);

    let history = [];
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }
    } catch (e) {
        console.error("Error reading history:", e);
    }

    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const algo = ALGOS[Math.floor(Math.random() * ALGOS.length)];
    const palette = NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)];

    // We use AI to generate a creative title and educational captions
    const prompt = `Generate educational metadata for a coding visualization video.
    Topic: ${algo} Algorithm implemented on the real-world streets of ${city.name}.
    Visual Theme: ${palette} neon palette.

    Format:
    - title: A catchy technical title (max 50 chars).
    - ig_caption: Educational Instagram caption with technical depth (explain ${algo}).
    - fb_caption: Engaging Facebook caption.
    - threads_caption: Short, punchy Threads caption.
    - yt_description: Detailed YouTube description.
    - hashtags: A string of relevant hashtags including #coding #algorithms #mapvis.

    Return ONLY a JSON object with these keys: "title", "ig_caption", "fb_caption", "threads_caption", "yt_description", "hashtags"`;

    try {
        let aiData = {};
        if (API_KEY) {
            const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gemini-fast',
                    messages: [
                        { role: 'system', content: 'You are an expert software engineer and tech educator.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            const data = await response.json();
            aiData = JSON.parse(data.choices[0].message.content);
        } else {
            console.warn("⚠️ No API Key found, using template metadata.");
            aiData = {
                title: `${algo} in ${city.name.split(' ')[0]}`,
                ig_caption: `Visualizing ${algo} on real maps!`,
                fb_caption: `Visualizing ${algo} on real maps!`,
                threads_caption: `Visualizing ${algo} on real maps!`,
                yt_description: `Visualizing ${algo} on real maps!`,
                hashtags: `#coding #algorithms #mapvis #${algo.replace(/\s/g, '')}`
            };
        }

        const finalTopic = {
            ...aiData,
            city: city.name,
            lat: city.lat,
            lng: city.lng,
            algorithm: algo,
            palette: palette
        };

        // Update history
        history.push(`${city.name}-${algo}`);
        if (history.length > 50) history.shift();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

        // Save to current_topic.json for the App
        const dataDir = path.dirname(TOPIC_FILE);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(TOPIC_FILE, JSON.stringify(finalTopic, null, 2));

        // Save to metadata.json in root for the Uploader
        fs.writeFileSync(path.join(__dirname, '../metadata.json'), JSON.stringify(finalTopic, null, 2));

        console.log(`✅ New topic and metadata generated: ${finalTopic.title}`);
        return finalTopic;

    } catch (error) {
        console.error('❌ Failed to generate topic:', error.message);
        // Fallback
        const fallback = {
            title: `${algo} in ${city.name}`,
            city: city.name,
            lat: city.lat,
            lng: city.lng,
            algorithm: algo,
            palette: palette
        };
        fs.writeFileSync(TOPIC_FILE, JSON.stringify(fallback, null, 2));
        return fallback;
    }
}

generateNewTopic();
