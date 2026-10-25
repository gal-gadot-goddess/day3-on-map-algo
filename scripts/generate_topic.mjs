import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { fetchGraphData } from '../src/utils/graphBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_KEY = process.env.POLLINATIONS_API_KEY;
const TOPIC_FILE = path.join(__dirname, '../src/data/current_topic.json');
const GRAPH_FILE = path.join(__dirname, '../src/data/current_graph.json');
const HISTORY_FILE = path.join(__dirname, '../topic_history.json');

const ALGOS = [
    'BFS', 'DFS', 'Dijkstra', 'A*', 'Greedy Best-First',
    'Bidirectional BFS', 'Bidirectional Dijkstra', 'Bidirectional A*'
];

const NEON_PALETTES = ['Toxic Sludge', 'Cyberpunk', 'Joker', 'Fire & Ice', 'Hotrod', 'Magma'];

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

function sanitizeHashtags(rawTags, algo) {
    const clean = [];
    const algoTag = '#' + algo.toLowerCase().replace(/[^a-z0-9]/g, '');

    clean.push('#kreggscode');
    if (!clean.includes(algoTag)) clean.push(algoTag);

    if (Array.isArray(rawTags)) {
        for (let t of rawTags) {
            if (typeof t !== 'string') continue;
            let ct = t.trim().toLowerCase();
            if (!ct.startsWith('#')) ct = '#' + ct;
            ct = ct.replace(/[^#a-z0-9_]/g, '');
            if (ct.length > 2 && !clean.includes(ct)) clean.push(ct);
        }
    }

    const fallbacks = ['#algorithms', '#coding', '#artificialintelligence', '#technology', '#systemdesign'];
    for (let f of fallbacks) {
        if (clean.length >= 5) break;
        if (!clean.includes(f)) clean.push(f);
    }
    return clean.slice(0, 5);
}

async function generateNewTopic() {
    console.log('Generating new Real Map Algorithm topic with SEO optimization...');

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
        console.log("Using curated SEO fallback selection...");
        const city = FALLBACK_CITIES[Math.floor(Math.random() * FALLBACK_CITIES.length)];
        const algo = forcedAlgo;
        const palette = NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)];
        topic = {
            city: city.name,
            lat: city.lat,
            lng: city.lng,
            algo,
            palette,
            title: `${algo} on ${city.name}: Real Map Routing ⚡`,
            description: `Visualizing ${algo} pathfinding algorithm on real street roads in ${city.name}.`,
            ig_caption: `⚡ ${algo} Algorithm Visualized on ${city.name}!\n\nEver wondered how GPS routing, technology, and artificial intelligence calculate optimal routes in real-time? Here is ${algo} pathfinding in action across real city streets.\n\n• Intersections represent graph nodes, roads represent weighted edges\n• Watch the search frontier explore the topological network until the optimal path is reached\n• Critical for GPS routing, autonomous vehicles, and high-performance system design\n\n💬 Which city or algorithm should we map next? Drop your thoughts below! 👇\n\n🔗 Interactive algorithm simulations & engineering guides: https://kreggscode.com\n📱 Discover our iOS & AI apps: https://kreggscode.com/apps/\nFollow @kreggscode | AI & System Architecture Studio`,
            fb_caption: `Deep-Dive Graph Theory: ${algo} on ${city.name} Street Network.\n\nNavigating complex urban road networks requires sophisticated graph algorithms. Here is a step-by-step visual exploration of ${algo} operating on genuine OpenStreetMap coordinates.\n\nExplore our interactive developer platform & apps at https://kreggscode.com and https://kreggscode.com/apps/`,
            yt_description: `Visualizing ${algo} pathfinding algorithm on the real street grid of ${city.name}.\n\nDiscover how graph theory, priority queues, and heuristic path search algorithms power modern GPS routing, AI navigation, and autonomous systems under the hood.\n\n🔗 Resources & Apps:\n🌐 Engineering Platform: https://kreggscode.com\n📱 Mobile & AI Apps: https://kreggscode.com/apps/\n💡 Guides: https://kreggscode.com/blog/\n\nFollow @kreggscode across platforms for daily software engineering, algorithms, and AI breakdowns.\n\n#Shorts #kreggscode #algorithms #coding #technology #artificialintelligence #pathfinding`,
            threads_caption: `${algo} visualized on real streets of ${city.name}. Explore interactive simulations at https://kreggscode.com | Follow @kreggscode`,
            hashtags: ["#kreggscode", `#${algo.toLowerCase().replace(/[^a-z0-9]/g, '')}`, "#algorithms", "#coding", "#artificialintelligence"]
        };
    }

    // Ensure topic has required fields
    topic.algo = forcedAlgo;
    topic.palette = topic.palette || NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)];
    topic.hashtags = sanitizeHashtags(topic.hashtags, forcedAlgo);

    // Pre-fetch and strictly verify genuine OpenStreetMap geometry
    console.log(`Verifying real street network for ${topic.city} at [${topic.lat}, ${topic.lng}]...`);
    const delta = 0.007;
    let bounds = {
        south: topic.lat - delta,
        west: topic.lng - delta,
        north: topic.lat + delta,
        east: topic.lng + delta
    };
    let graph = await fetchGraphData(bounds);

    // If AI coordinates yielded too few roads (water, outskirts), fall back through vetted world cities
    let fbIndex = 0;
    while ((!graph || Object.keys(graph.nodes).length < 30) && fbIndex < FALLBACK_CITIES.length) {
        const fb = FALLBACK_CITIES[fbIndex++];
        console.warn(`⚠️ City ${topic.city} yielded insufficient roads. Trying vetted fallback: ${fb.name}`);
        topic.city = fb.name;
        topic.lat = fb.lat;
        topic.lng = fb.lng;
        topic.title = `${topic.algo} on ${fb.name} ⚡`;
        topic.description = `Visualizing ${topic.algo} pathfinding on ${fb.name}`;
        bounds = {
            south: topic.lat - delta,
            west: topic.lng - delta,
            north: topic.lat + delta,
            east: topic.lng + delta
        };
        graph = await fetchGraphData(bounds);
    }

    if (!graph || Object.keys(graph.nodes).length < 20) {
        throw new Error("FATAL: Unable to load genuine OpenStreetMap roads for topic.");
    }

    // Save pre-fetched verified real street graph to disk
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
    console.log(`✅ Real OpenStreetMap graph saved: ${Object.keys(graph.nodes).length} street intersections.`);

    const entry = topic.city + "-" + topic.algo;
    history.push(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    // Guarantee official SEO footer is present in all captions
    let ig_caption = topic.ig_caption || topic.description;
    if (!ig_caption.includes('kreggscode.com')) {
        ig_caption += `\n\n🔗 Interactive algorithm simulations & engineering guides: https://kreggscode.com\n📱 Discover our iOS & AI apps: https://kreggscode.com/apps/\nFollow @kreggscode | AI & System Architecture Studio`;
    }

    let fb_caption = topic.fb_caption || topic.description;
    if (!fb_caption.includes('kreggscode.com')) {
        fb_caption += `\n\nExplore interactive algorithms & apps at https://kreggscode.com and https://kreggscode.com/apps/`;
    }

    let yt_description = topic.yt_description || topic.description;
    if (!yt_description.includes('kreggscode.com')) {
        yt_description += `\n\n🔗 Official Resources:\n🌐 Platform: https://kreggscode.com\n📱 Apps Portfolio: https://kreggscode.com/apps/\nFollow @kreggscode for daily software engineering and AI.\n\n#Shorts #kreggscode #algorithms #coding #technology #artificialintelligence`;
    }

    let threads_caption = topic.threads_caption || topic.description;
    if (!threads_caption.includes('kreggscode.com')) {
        threads_caption += ` | https://kreggscode.com`;
    }

    const topicData = {
        title: topic.title,
        description: topic.description,
        ig_caption: ig_caption,
        fb_caption: fb_caption,
        yt_description: yt_description,
        threads_caption: threads_caption,
        algo: topic.algo,
        palette: topic.palette,
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

    const prompt = `You are a top viral social media growth engineer and senior AI/algorithms educator managing @kreggscode (https://kreggscode.com).
We are generating a real-world city pathfinding visualization video for the algorithm '${forcedAlgo}'.

Pick any real city in the world (be creative - avoid repeating common cities).

GOALS:
- Optimize for Google "Short Videos" indexing, YouTube Shorts search, Instagram Explore search, and Google Search Console Creator Insights for @kreggscode.
- Naturally weave in target search keywords: "technology", "artificial intelligence", "algorithms", "system design", "coding", "software engineering".
- Build strong backlink and entity recognition for "KreggsCode", "https://kreggscode.com", and "@kreggscode".

Return ONLY valid JSON with fields:
- city: string with district like 'Kyoto (Gion)' or 'Barcelona (Eixample)'
- lat: number
- lng: number
- algo: must be exactly '${forcedAlgo}' - do not change it
- title: creative engaging hook title max 60 chars specifically naming ${forcedAlgo} (e.g. "${forcedAlgo} on Tokyo: Real Map Routing ⚡")
- description: engaging 2-sentence summary
- ig_caption: beautifully structured Instagram caption with:
  * First 2 lines (before the fold / first 120 chars): High-intent query hook with target tech keywords for Google search indexing
  * Deep technical explanation of ${forcedAlgo} and graph theory on real street maps
  * Practical engineering takeaway
  * Comment debate question
  * Mandatory brand footer:
    🔗 Interactive algorithms & guides: https://kreggscode.com
    📱 Mobile & AI Apps: https://kreggscode.com/apps/
    Follow @kreggscode | Autonomous AI & Systems Studio
- fb_caption: educational Facebook post caption explaining graph search and community sharing hook with links to https://kreggscode.com
- yt_description: high-converting YouTube Shorts description with search-optimized keywords, mechanics, official links to https://kreggscode.com and https://kreggscode.com/apps/, and #Shorts tags
- threads_caption: punchy takeaway + link to https://kreggscode.com (max 280 chars)
- hashtags: strictly 5 targeted lowercase hashtags including '#kreggscode' (e.g. ['#kreggscode', '#algorithms', '#coding', '#artificialintelligence', '#technology'])

No markdown wrapper, return ONLY the JSON object.`;

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

generateNewTopic().catch(err => {
    console.error("Topic generation failed:", err);
    process.exit(1);
});
