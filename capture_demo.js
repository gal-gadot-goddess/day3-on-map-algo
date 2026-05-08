import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import ffmpeg from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_ONLY = path.join(__dirname, 'temp_video.mp4');
const AUDIO_ONLY = path.join(__dirname, 'temp_audio.webm');
const FINAL_OUTPUT = path.join(__dirname, 'output_kreggscode.mp4');

(async () => {
    console.log('🚀 Launching Map Visualization Capture Engine...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--window-size=1080,1920',
            '--autoplay-policy=no-user-gesture-required',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });

    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

    const audioChunks = [];
    await page.exposeFunction('sendAudioChunk', (base64) => {
        audioChunks.push(Buffer.from(base64, 'base64'));
    });

    console.log('📡 Navigating to Application...');
    const url = 'http://localhost:3003/?automate=true';
    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('🎙️ Injecting Audio & Video Sync Logic...');
    await page.evaluate(() => {
        window.startAudioCapture = () => {
            const soundManager = window.soundManager;
            if (!soundManager) return console.error('Browser soundManager not found');

            // Access underlying AudioContext
            const audioCtx = soundManager.audioContext || soundManager.ctx;
            const masterGain = soundManager.masterGain;

            console.log(`[AUDIO] Context: ${!!audioCtx}, MasterGain: ${!!masterGain}`);
            if (!audioCtx || !masterGain) return console.error('Browser audio components not found');

            const dest = audioCtx.createMediaStreamDestination();
            masterGain.connect(dest);

            const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
            recorder.ondataavailable = async (e) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    window.sendAudioChunk(base64);
                };
                reader.readAsDataURL(e.data);
            };
            recorder.start(1000);
            window._audioRecorder = recorder;
            console.log('Browser audio recording active');
        };
    });

    const videoRecorder = new PuppeteerScreenRecorder(page, {
        fps: 60,
        videoFrame: { width: 1080, height: 1920 },
        videoBitrate: 8000,
        audio: false
    });

    console.log('📡 Waiting for synchronization flag (readyToRecord)...');
    await page.waitForFunction(() => window.readyToRecord === true, { timeout: 120000 });

    console.log('🎙️ Starting synchronised capture...');
    await videoRecorder.start(VIDEO_ONLY);
    await page.evaluate(() => window.startAudioCapture());

    console.log('⏳ Recording in progress...');
    // The App sets isSortingCompleted=true when path found
    await page.waitForFunction(() => window.isSortingCompleted === true, { timeout: 300000 });

    console.log('✨ Path found! Capturing finale...');
    await new Promise(r => setTimeout(r, 6000)); // Longer buffer for visual satisfaction

    // CAPTURE THUMBNAIL FOR INSTAGRAM (Clean - No UI)
    console.log('📸 Hiding UI & Saving thumbnail...');
    await page.addStyleTag({
        content: `
        .leaflet-control-container, .glass-panel, .control-panel, .leaflet-top, .leaflet-bottom { display: none !important; } 
    `});
    await new Promise(r => setTimeout(r, 500)); // Wait for hide
    await page.screenshot({ path: path.join(__dirname, 'final_path_thumbnail.jpg'), type: 'jpeg', quality: 90 });

    console.log('🛑 Stopping...');
    await videoRecorder.stop();
    await page.evaluate(() => {
        if (window._audioRecorder && window._audioRecorder.state !== 'inactive') {
            window._audioRecorder.stop();
        }
    });

    await new Promise(r => setTimeout(r, 3000));

    if (audioChunks.length > 0) {
        fs.writeFileSync(AUDIO_ONLY, Buffer.concat(audioChunks));
        console.log('🎬 Merging with FFmpeg...');
        try {
            execSync(`"${ffmpeg}" -y -i "${VIDEO_ONLY}" -i "${AUDIO_ONLY}" -c:v copy -c:a aac -b:a 192k -shortest "${FINAL_OUTPUT}"`);
            console.log(`✅ COMPLETE! Saved to: ${FINAL_OUTPUT}`);
        } catch (e) {
            console.error('Merge failed:', e.message);
        }
    } else {
        console.error('❌ No audio captured!');
        fs.renameSync(VIDEO_ONLY, FINAL_OUTPUT);
    }

    // --- AI METADATA GENERATION ---
    try {
        console.log('🤖 Generating AI Metadata...');

        // 1. Get Context from Browser
        const meta = await page.evaluate(() => window.metaData || { city: 'Unknown', algorithm: 'Pathfinding', theme: 'Neon', description: 'Real map pathfinding.' });
        console.log('📌 Context:', meta);

        // 2. Read API Key
        let apiKey = process.env.POLLINATIONS_API_KEY;

        if (!apiKey) {
            try {
                const envPath = path.resolve(__dirname, '../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const match = envContent.match(/POLLINATIONS_API_KEY=(.*)/);
                    if (match) apiKey = match[1].trim();
                }
            } catch (e) {
                console.warn('⚠️ Could not read .env for API Key:', e.message);
            }
        }

        if (apiKey) {
            const prompt = `Write a detailed, educational, technical Instagram caption for a coding visualization video.
            
            Details:
            - Algorithm: ${meta.algorithm}
            - Technical Description: ${meta.description}
            - City: ${meta.city}
            - Concept: Real-world Graph Theory application (Nodes = Intersections, Edges = Streets).
            
            Format:
            Real Map Implementation of ${meta.algorithm}
            
            [Paragraph 1: Explain the specific logic of ${meta.algorithm}. How does it prioritize neighbors? What data structures does it use (Queue, Stack, Priority Queue)? Be technical but clear.]
            
            [Paragraph 2: Explain the "Real Map Implementation". How do we turn a city like ${meta.city} into a graph? Explain that red/green lines are "visited edges" exploring the graph, and the yellow line is the computed path. Explain the complexity differences on real roads vs explicit grids.]
            
            #realmapimplementation #${meta.algorithm.toLowerCase().replace(/\s/g, '')} #coding`;

            const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gemini-fast',
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiText = data.choices[0].message.content;
                fs.writeFileSync(path.join(__dirname, 'video_metadata.txt'), aiText);
                console.log('✅ Metadata saved to video_metadata.txt');
                console.log(aiText);
            } else {
                console.error('❌ AI Request Failed:', await response.text());
            }
        } else {
            console.warn('⚠️ No API Key found, skipping metadata generation.');
        }

    } catch (e) {
        console.error('❌ Metadata Generation Error:', e);
    }

    await browser.close();
    if (fs.existsSync(VIDEO_ONLY)) fs.unlinkSync(VIDEO_ONLY);
    if (fs.existsSync(AUDIO_ONLY)) fs.unlinkSync(AUDIO_ONLY);

})().catch(err => console.error('💥 Error:', err));
