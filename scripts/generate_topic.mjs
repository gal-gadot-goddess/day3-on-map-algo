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

// Pick the algorithm that has been used least recently (enforces rotation
// across all 8 algorithms instead of letting the AI always choose A*).
function pickNextAlgorithm(history) {
    const counts = {};
    for (const algo of ALGOS) counts[algo] = 0;

    for (const entry of history) {
        for (const algo of ALGOS) {
            if (entry.includes(algo)) counts[algo]++;
        }
    }

    const minCount = Math.min(...Object.values(counts));
    const leastUsed = ALGOS.filter(a => counts[a] === minCount);

    // Among the least-used, prefer the one used longest ago
    for (let i = history.length - 1; i >= 0; i--) {
        const recent = leastUsed.filter(a => !history[i].includes(a));
        if (recent.length === 1) return recent[0];
    }

    return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}

async function generateNewTopic() {
    console.log('Generating new Real Map Algorithm topic...');

    let history = [];
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        }
    } catch (e) {
        console.error("Error reading history:", e);
    }

    // Enforce algorithm rotation: pick the least-recently-used algorithm now
    const forcedAlgo = pickNextAlgorithm(history);
    console.log("Selected algorithm for this round:", forcedAlgo);

    // Use AI to generate a city+title
    let topic;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            topic = await generateWithAI(history, forcedAlgo);
            if (topic) {
                const cityName = topic.city.split(' (')[0];
                const alreadyUsed = history.some(h =>
                    h.includes(cityName) && h.includes(topic.algo)
                );
                if (!alreadyUsed) break;
            }
        } catch (e) {
            console.error("AI generation attempt " + attempts + " failed:", e.message);
        }
    }

    if (!topic) {
        console.log("Using fallback random selection...");
        const FALLBACK_CITIES = [
            { name: 'New York (SoHo)', lat: 40.7233, lng: -73.9988 },
            { name: 'Tokyo (Shibuya)', lat: 35.6580, lng: 139.7016 },
            { name: 'Paris (Marais)', lat: 48.8584, lng: 2.3551 },
            { name: 'Barcelona (Eixample)', lat: 41.3934, lng: 2.1643 },
            { name: 'Dubai (Downtown)', lat: 25.2048, lng: 55.2708 },
            { name: 'Berlin (Mitte)', lat: 52.5200, lng: 13.4050 },
            { name: 'Sydney (CBD)', lat: -33.8688, lng: 151.2093 },
            { name: 'Seoul (Gangnam)', lat: 37.5172, lng: 127.0473 },
            { name: 'Singapore (Marina Bay)', lat: 1.2831, lng: 103.8513 },
            { name: 'Istanbul (Beyoglu)', lat: 41.0295, lng: 28.9753 }
        ];
        const city = FALLBACK_CITIES[Math.floor(Math.random() * FALLBACK_CITIES.length)];
        const algo = forcedAlgo;
        const palette = NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)];
        topic = { city: city.name, lat: city.lat, lng: city.lng, algo, palette, title: algo + " on " + city.name, description: "Visualizing " + algo + " pathfinding on " + city.name, hashtags: "#pathfinding #algorithm #visualization" };
    }

    const entry = topic.city + "-" + topic.algo;
    history.push(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    const topicData = {
        title: topic.title,
        description: topic.description,
        ig_caption: topic.ig_caption || topic.description,
        fb_caption: topic.fb_caption || topic.description,
        yt_description: topic.yt_description || topic.description,
        threads_caption: topic.threads_caption || topic.description,
        algo: topic.algo,
        palette: topic.palette || NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)],
        city: topic.city,
        lat: topic.lat,
        lng: topic.lng,
        hashtags: topic.hashtags
    };

    fs.writeFileSync(TOPIC_FILE, JSON.stringify(topicData, null, 2));
    console.log("Topic generated:", topicData.title);
}

async function generateWithAI(history, forcedAlgo) {
    const url = "https://gen.pollinations.ai/v1/chat/completions";
    const headers = {
        "Authorization": "Bearer " + API_KEY,
        "Content-Type": "application/json"
    };

    const prompt = "Generate a unique real-world city and dedicated social media captions for a pathfinding algorithm visualization video.\n"
        + "Pick any real city in the world (be creative - avoid repeating common cities).\n"
        + "Return ONLY valid JSON with fields:\n"
        + "- city: string with district like 'Kyoto (Gion)' or 'Barcelona (Eixample)'\n"
        + "- lat: number\n"
        + "- lng: number\n"
        + "- algo: must be exactly '" + forcedAlgo + "' - do not change it\n"
        + "- title: creative engaging hook title max 60 chars specifically naming " + forcedAlgo + "\n"
        + "- description: engaging 2-sentence summary\n"
        + "- ig_caption: beautifully structured Instagram caption with emojis, deep technical explanation of " + forcedAlgo + ", graph theory on real street maps, and call-to-action\n"
        + "- fb_caption: educational Facebook post caption explaining graph search and community sharing hook\n"
        + "- yt_description: high-converting YouTube Shorts description with search-optimized keywords and mechanics\n"
        + "- hashtags: 5-7 targeted hashtags like '#realmapalgorithms #" + forcedAlgo.toLowerCase().replace(/[^a-z0-9]/g, '') + " #coding #computerscience #algorithms'\n"
        + "No markdown wrapper, return ONLY the JSON object.";

    const payload = {
        model: "openai",
        messages: [
            { role: "system", content: "You generate unique city+algorithm topics and high-engagement social media captions for educational coding reels. Always return valid JSON only." },
            { role: "user", content: prompt }
        ],
        temperature: 0.9,
        seed: Math.floor(Math.random() * 999999)
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("API returned " + resp.status);

    const data = await resp.json();
    let text = data.choices[0].message.content;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);
    // Force the algorithm regardless of what the AI returned
    parsed.algo = forcedAlgo;
    return parsed;
}

generateNewTopic().catch(console.error);
