// Continuous ASMR Audio Engine for Real-Map Algorithm Visualizer
// Unbroken Marimba Traversal + Ambient Resonance + Clean Victory Chime

class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.45;
        this.tickCounter = 0;
        this.panIndex = 0;
        this.searchProgress = 0;
        this.ambientGain = null;
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;

        this.loadSounds();
        if (this.audioContext) {
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
        }
    }

    loadSounds() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.audioContext = new AudioCtx();
                this.ctx = this.audioContext;
            }
        } catch (e) {
            console.warn('Web Audio API not supported', e);
            this.enabled = false;
        }
    }

    setProgress(p) {
        this.searchProgress = Math.max(0, Math.min(1, p));
    }

    createPanner(panValue = 0) {
        if (!this.audioContext) return null;
        if (this.audioContext.createStereoPanner) {
            const panner = this.audioContext.createStereoPanner();
            panner.pan.value = Math.max(-1, Math.min(1, panValue));
            return panner;
        }
        return null;
    }

    // --- CONTINUOUS AMBIENT GLOW (Zero Silence Gaps) ---
    startAmbient() {
        if (!this.enabled || !this.audioContext) return;
        const ctx = this.audioContext;
        if (ctx.state === 'suspended') ctx.resume();

        this.stopAmbient();

        try {
            const now = ctx.currentTime;
            this.ambientGain = ctx.createGain();
            this.ambientGain.gain.setValueAtTime(0.0001, now);
            this.ambientGain.gain.linearRampToValueAtTime(0.065, now + 0.3); // Subtle velvety warmth

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320, now);

            this.ambientOsc1 = ctx.createOscillator();
            this.ambientOsc2 = ctx.createOscillator();

            this.ambientOsc1.type = 'sine';
            this.ambientOsc1.frequency.setValueAtTime(130.81, now); // C3 fundamental

            this.ambientOsc2.type = 'triangle';
            this.ambientOsc2.frequency.setValueAtTime(196.00, now); // G3 fifth

            this.ambientOsc1.connect(filter);
            this.ambientOsc2.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.masterGain || ctx.destination);

            this.ambientOsc1.start(now);
            this.ambientOsc2.start(now);
        } catch (e) {
            console.warn('Ambient start failed:', e);
        }
    }

    stopAmbient() {
        if (!this.audioContext) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        if (this.ambientGain) {
            try {
                this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
            } catch (e) {}
        }
        if (this.ambientOsc1) {
            try {
                this.ambientOsc1.stop(now + 0.3);
                this.ambientOsc1.disconnect();
            } catch (e) {}
            this.ambientOsc1 = null;
        }
        if (this.ambientOsc2) {
            try {
                this.ambientOsc2.stop(now + 0.3);
                this.ambientOsc2.disconnect();
            } catch (e) {}
            this.ambientOsc2 = null;
        }
    }

    // --- ORGANIC ACOUSTIC MARIMBA NOTE ---
    playMarimbaNote(freq, velocity = 1.0) {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const noteVol = this.volume * velocity;
        const duration = 0.16;

        // Subtle organic stereo panning
        const panPositions = [-0.2, 0.18, -0.12, 0.22, -0.08, 0.14];
        const pan = panPositions[this.panIndex % panPositions.length];
        this.panIndex++;

        const panner = this.createPanner(pan);
        const voiceGain = ctx.createGain();

        if (panner) {
            voiceGain.connect(panner);
            panner.connect(this.masterGain || ctx.destination);
        } else {
            voiceGain.connect(this.masterGain || ctx.destination);
        }

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const cutoff = 1300 + (this.searchProgress * 1400);
        filter.frequency.setValueAtTime(cutoff, now);
        filter.frequency.exponentialRampToValueAtTime(450, now + duration);
        filter.Q.value = 2.0;

        // Dual Oscillator: Sine core (wooden bar) + Triangle overtone (soft mallet strike)
        const oscFundamental = ctx.createOscillator();
        const oscMallet = ctx.createOscillator();

        oscFundamental.type = 'sine';
        oscFundamental.frequency.setValueAtTime(freq, now);

        oscMallet.type = 'triangle';
        oscMallet.frequency.setValueAtTime(freq * 3.0, now);

        voiceGain.gain.setValueAtTime(0, now);
        voiceGain.gain.linearRampToValueAtTime(noteVol * 0.6, now + 0.003);
        voiceGain.gain.exponentialRampToValueAtTime(noteVol * 0.18, now + 0.045);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscFundamental.connect(filter);
        oscMallet.connect(filter);
        filter.connect(voiceGain);

        oscFundamental.start(now);
        oscMallet.start(now);
        oscFundamental.stop(now + duration + 0.03);
        oscMallet.stop(now + duration + 0.03);
    }

    // --- CONTINUOUS FRAME-ACCURATE TRAVERSAL STEP ---
    playTick(progressOverride = null) {
        if (!this.enabled || !this.audioContext) return;

        if (progressOverride !== null) {
            this.searchProgress = Math.max(0, Math.min(1, progressOverride));
        }

        try {
            // Harmonic Pentatonic Scale across multiple octaves
            const scale = [
                261.63, // C4
                293.66, // D4
                329.63, // E4
                392.00, // G4
                440.00, // A4
                523.25, // C5
                587.33, // D5
                659.25, // E5
                783.99, // G5
                880.00  // A5
            ];

            // 16-step continuous musical contour that rises with search progress
            const pattern = [0, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 6, 5, 4, 2];
            const baseStep = this.tickCounter % pattern.length;
            
            // Progressive pitch lift as destination is approached
            const octaveShift = this.searchProgress > 0.65 ? 2 : (this.searchProgress > 0.35 ? 1 : 0);
            const noteIdx = Math.min(scale.length - 1, pattern[baseStep] + octaveShift);
            const freq = scale[noteIdx];

            const isBeat = baseStep % 4 === 0;
            const velocity = isBeat ? 1.12 : 0.85;

            this.playMarimbaNote(freq, velocity);
            this.tickCounter++;
        } catch (e) {
            // Silently fail
        }
    }

    // --- FINAL PATH RESOLUTION ARPEGGIO ---
    playPathFound() {
        if (!this.enabled || !this.audioContext) return;
        const ctx = this.audioContext;
        if (ctx.state === 'suspended') ctx.resume();

        const arpeggio = [
            { freq: 523.25, delay: 0.00 }, // C5
            { freq: 659.25, delay: 0.06 }, // E5
            { freq: 783.99, delay: 0.12 }, // G5
            { freq: 1046.50, delay: 0.18 }  // C6
        ];

        arpeggio.forEach(note => {
            setTimeout(() => {
                this.playMarimbaNote(note.freq, 1.25);
            }, note.delay * 1000);
        });
    }

    // --- CLEAN, SIMPLE & LIGHT VICTORY CHIME ---
    playSuccess() {
        if (!this.enabled || !this.audioContext) return;
        this.stopAmbient();

        try {
            const ctx = this.audioContext;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;

            // Simple, light 2-tone crystal bell chime (G5 -> C6)
            const chimeNotes = [
                { freq: 783.99, delay: 0.0, vol: 0.45, dur: 0.35 },    // G5
                { freq: 1046.50, delay: 0.12, vol: 0.55, dur: 0.65 }   // C6
            ];

            chimeNotes.forEach(note => {
                const noteTime = now + note.delay;
                const osc = ctx.createOscillator();
                const harmonicOsc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(note.freq, noteTime);

                harmonicOsc.type = 'triangle';
                harmonicOsc.frequency.setValueAtTime(note.freq * 2, noteTime);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(4500, noteTime);
                filter.frequency.exponentialRampToValueAtTime(1200, noteTime + note.dur);

                gain.gain.setValueAtTime(0, noteTime);
                gain.gain.linearRampToValueAtTime(this.volume * note.vol, noteTime + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + note.dur);

                osc.connect(filter);
                harmonicOsc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain || ctx.destination);

                osc.start(noteTime);
                harmonicOsc.start(noteTime);
                osc.stop(noteTime + note.dur + 0.05);
                harmonicOsc.stop(noteTime + note.dur + 0.05);
            });

        } catch (e) {
            console.error('Success sound error:', e);
        }
    }

    playError() {
        if (!this.enabled || !this.audioContext) return;
        try {
            this.playMarimbaNote(196.00, 0.5);
            setTimeout(() => this.playMarimbaNote(174.61, 0.5), 100);
        } catch (e) {}
    }

    startAmbientSound() {
        this.startAmbient();
    }

    stopAmbientSound() {
        this.stopAmbient();
    }

    startTickLoop(intervalMs = 80) {
        this.stopTickLoop();
        this.tickCounter = 0;
        this.startAmbient();
        this.tickInterval = setInterval(() => this.playTick(), intervalMs);
    }

    stopTickLoop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.stopAmbient();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopTickLoop();
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

const soundManager = new SoundManager();
window.soundManager = soundManager;

export default soundManager;
