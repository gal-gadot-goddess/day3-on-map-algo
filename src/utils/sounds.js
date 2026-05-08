// Enhanced Sound System for Pathfinding Visualizer
// Professional-quality audio feedback with rich synthesis - PIANO EDITION

class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.4;
        this.tickInterval = null;
        this.ambientOscillators = [];
        this.ambientGains = [];
        this.ambientFilters = [];
        this.tickCounter = 0;
        this.loadSounds();
        if (this.audioContext) {
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
        }
    }

    loadSounds() {
        // Initialize Web Audio API for generating sounds
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    // Create a reverb effect using convolution
    createReverb() {
        if (!this.audioContext) return null;

        const convolver = this.audioContext.createConvolver();
        const rate = this.audioContext.sampleRate;
        const length = rate * 2; // 2 second reverb
        const impulse = this.audioContext.createBuffer(2, length, rate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) { // Decay
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        convolver.buffer = impulse;
        return convolver;
    }

    // Generate a sharp piano-like tone using additive synthesis
    generatePianoTone(frequency, duration, volume = 0.3, time = 0) {
        if (!this.enabled || !this.audioContext) return;

        const now = time || this.audioContext.currentTime;

        // Piano physics: Fundamental + Harmonics
        // Real pianos have specific overtones that make them sound like pianos
        const harmonics = [
            { mult: 1, gain: 1.0 },    // Fundamental
            { mult: 2, gain: 0.4 },    // Octave
            { mult: 3, gain: 0.2 },    // Fifth
            { mult: 4, gain: 0.1 },    // 2 Octaves
            { mult: 5, gain: 0.05 }    // Major 3rd
        ];

        harmonics.forEach(h => {
            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            osc.frequency.value = frequency * h.mult;

            // Slight detuning for realism (inharmonicity)
            if (h.mult > 1) {
                osc.detune.value = Math.random() * 10 - 5;
            }

            osc.type = h.mult % 2 === 0 ? 'sine' : 'triangle'; // Mix of waves for texture

            // Percussive Envelope (Sharp Attack, Quick Decay)
            const attack = 0.005; // Very fast attack (hammer strike)
            const decay = 0.1;
            const sustain = 0; // Pianos don't sustain indefinitely at peak volume
            const release = duration; // The "note length"

            const noteVolume = volume * h.gain;

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(noteVolume, now + attack);
            gainNode.gain.exponentialRampToValueAtTime(noteVolume * 0.3, now + attack + decay); // Initial decay
            gainNode.gain.linearRampToValueAtTime(0, now + duration); // Fade out

            osc.connect(gainNode);
            gainNode.connect(this.masterGain || this.audioContext.destination);

            osc.start(now);
            osc.stop(now + duration + 0.1);
        });
    }

    // Improved tick sound: Sharp piano note providing a "tempo"
    playTick() {
        if (!this.enabled || !this.audioContext) return;

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        try {
            // Musical scale mapping (Pentatonic C Majorish)
            // Creates a melodic pattern as it searches
            const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C5, D5, E5, G5, A5, C6

            // Use tick counter to pick note - creates a rhythmic pattern
            const noteIndex = Math.floor(this.tickCounter / 2) % scale.length;
            const freq = scale[noteIndex];

            // Sharp, short, percussive piano sound (Staccato)
            // Volume modulated slightly for grooviness
            const vol = this.volume * (0.2 + (this.tickCounter % 4 === 0 ? 0.1 : 0));

            this.generatePianoTone(freq, 0.1, vol);

            this.tickCounter++;
        } catch (e) {
            // Silently fail
        }
    }

    // Triumphant success sound with ascending chord progression
    playSuccess() {
        if (!this.enabled || !this.audioContext) return;

        try {
            const now = this.audioContext.currentTime;

            // Create reverb for spacious sound
            const reverb = this.createReverb();
            const reverbGain = this.audioContext.createGain();
            reverbGain.gain.value = 0.4;

            if (reverb) {
                reverb.connect(reverbGain);
                reverbGain.connect(this.masterGain || this.audioContext.destination);
            }

            // Chord progression: C Major 9 -> F Major 7 -> G Dominant -> C Major (Grand Finale)
            // Played as quick arpeggios
            const chords = [
                [523.25, 659.25, 783.99, 987.77, 1174.66], // C Major 9
                [523.25, 698.46, 880.00, 1046.50, 1318.51] // F Major 7
            ];

            chords.forEach((chord, index) => {
                setTimeout(() => {
                    chord.forEach((freq, noteIndex) => {
                        this.generatePianoTone(freq, 1.5, this.volume * 0.4, now + (index * 0.4) + (noteIndex * 0.03));
                    });
                }, 0);
            });

            // Final C Chord strike
            setTimeout(() => {
                this.generatePianoTone(523.25, 2.0, this.volume * 0.5); // C5
                this.generatePianoTone(659.25, 2.0, this.volume * 0.5); // E5
                this.generatePianoTone(783.99, 2.0, this.volume * 0.5); // G5
                this.generatePianoTone(1046.50, 2.0, this.volume * 0.6); // C6
            }, 800);

        } catch (e) {
            console.error('Success sound error:', e);
        }
    }

    playError() {
        if (!this.enabled || !this.audioContext) return;

        try {
            // Descending dissonant tones (Low piano rumble)
            this.generatePianoTone(110, 0.4, this.volume * 0.5); // A2
            setTimeout(() => this.generatePianoTone(103.83, 0.5, this.volume * 0.5), 100); // G#2
        } catch (e) {
            // Silently fail
        }
    }

    // Rich ambient soundscape during visualization
    startAmbientSound() {
        if (!this.enabled || !this.audioContext) return;
        this.stopAmbientSound();

        try {
            // We want a "sharp piano tempo" feel, so we actually rely on the TICK sounds to provide the rhythm.
            // The ambient sound will just be a VERY subtle atmosphere to fill the silence between ticks.
            // No windy noise, just a very low, warm pad.

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Just a barely audible low sine wave for "presence"
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = 55; // Low A

            gain.gain.value = this.volume * 0.05; // Very quiet

            osc.connect(gain);
            gain.connect(this.masterGain || this.audioContext.destination);

            osc.start();
            this.ambientOscillators.push(osc);
            this.ambientGains.push(gain);

        } catch (e) {
            console.error('Ambient sound error:', e);
        }
    }

    stopAmbientSound() {
        const now = this.audioContext ? this.audioContext.currentTime : 0;

        // Fade out
        this.ambientGains.forEach(gain => {
            try {
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
            } catch (e) { }
        });

        setTimeout(() => {
            this.ambientOscillators.forEach(osc => {
                try { osc.stop(); } catch (e) { }
            });
            this.ambientOscillators = [];
            this.ambientGains = [];
        }, 250);
    }

    // Start playing tick sounds at regular intervals during pathfinding
    startTickLoop(intervalMs = 80) {
        this.stopTickLoop();
        this.tickCounter = 0;
        this.tickInterval = setInterval(() => this.playTick(), intervalMs);
    }

    stopTickLoop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.stopAmbientSound();
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

// Create singleton instance
const soundManager = new SoundManager();

export default soundManager;
