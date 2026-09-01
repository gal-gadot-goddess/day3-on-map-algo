// Pro Sound Engine for Real-Map Algorithm Visualizer
// Option: Organic ASMR Wooden Marimba / Kalimba + Clean Simple Chime

class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.42;
        this.tickInterval = null;
        this.ambientOscillators = [];
        this.ambientGains = [];
        this.ambientFilters = [];
        this.tickCounter = 0;
        this.panIndex = 0;
        this.searchProgress = 0;

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

    // --- ORGANIC WOODEN MARIMBA / KALIMBA TONE ---
    playMarimbaNote(freq, velocity = 1.0) {
        if (!this.enabled || !this.audioContext) return;

        const ctx = this.audioContext;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const noteVol = this.volume * velocity;
        const duration = 0.14;

        // Gentle stereo panning
        const panPositions = [-0.25, 0.2, -0.15, 0.25, -0.1, 0.15];
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

        // Lowpass filter for smooth wooden body resonance
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const cutoff = 1400 + (this.searchProgress * 1200);
        filter.frequency.setValueAtTime(cutoff, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + duration);
        filter.Q.value = 2.2;

        // Dual Oscillator: Sine core (wooden bar fundamental) + Triangle overtone (soft mallet strike)
        const oscFundamental = ctx.createOscillator();
        const oscMallet = ctx.createOscillator();

        oscFundamental.type = 'sine';
        oscFundamental.frequency.setValueAtTime(freq, now);

        oscMallet.type = 'triangle';
        oscMallet.frequency.setValueAtTime(freq * 3.0, now); // 3rd harmonic wooden click

        // Percussive wooden envelope: instant punchy mallet attack (3ms), rapid natural dampening
        voiceGain.gain.setValueAtTime(0, now);
        voiceGain.gain.linearRampToValueAtTime(noteVol * 0.55, now + 0.003);
        voiceGain.gain.exponentialRampToValueAtTime(noteVol * 0.15, now + 0.04);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscFundamental.connect(filter);
        oscMallet.connect(filter);
        filter.connect(voiceGain);

        oscFundamental.start(now);
        oscMallet.start(now);
        oscFundamental.stop(now + duration + 0.03);
        oscMallet.stop(now + duration + 0.03);
    }

    // Rhythmic Marimba Step
    playTick() {
        if (!this.enabled || !this.audioContext) return;

        try {
            // Warm Pentatonic Scale (Acoustic Marimba: C4, D4, E4, G4, A4, C5, D5, E5, G5)
            const scale = [
                261.63, // C4
                293.66, // D4
                329.63, // E4
                392.00, // G4
                440.00, // A4
                523.25, // C5
                587.33, // D5
                659.25, // E5
                783.99  // G5
            ];

            // 12-step flowing musical pattern
            const pattern = [0, 2, 4, 3, 5, 4, 6, 5, 7, 6, 5, 3];
            const step = this.tickCounter % pattern.length;
            const freq = scale[pattern[step] % scale.length];

            // Velocity dynamic: slightly accented on quarter beats
            const isBeat = step % 3 === 0;
            const velocity = isBeat ? 1.15 : 0.82;

            this.playMarimbaNote(freq, velocity);
            this.tickCounter++;
        } catch (e) {
            // Silently fail
        }
    }

    // --- CLEAN, SIMPLE & LIGHT VICTORY CHIME ---
    playSuccess() {
        if (!this.enabled || !this.audioContext) return;

        try {
            const ctx = this.audioContext;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;

            // Simple, light, pleasant 2-tone crystal bell (G5 -> C6)
            const chimeNotes = [
                { freq: 783.99, delay: 0.0, vol: 0.45, dur: 0.35 },    // G5 (bright, light)
                { freq: 1046.50, delay: 0.12, vol: 0.55, dur: 0.65 }   // C6 (sparkling high resolution)
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
            const now = this.audioContext.currentTime;
            this.playMarimbaNote(196.00, 0.5);
            setTimeout(() => this.playMarimbaNote(174.61, 0.5), 100);
        } catch (e) {
            // Silently fail
        }
    }

    startAmbientSound() {
        // Minimal warm presence
    }

    stopAmbientSound() {
    }

    startTickLoop(intervalMs = 95) {
        this.stopTickLoop();
        this.tickCounter = 0;
        this.tickInterval = setInterval(() => this.playTick(), intervalMs);
    }

    stopTickLoop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
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
