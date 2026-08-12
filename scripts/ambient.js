// MioBook Phase 6 – Side Panel additions:
// 1. Ambient Noise Generator (synthesized via Web Audio API, fully offline)
// 2. Word Bank (vocabulary builder with local storage)

// ============================================================
// AMBIENT SOUND ENGINE
// ============================================================
class AmbientSoundEngine {
    constructor() {
        this.ctx = null;
        this.nodes = [];
        this.gainNode = null;
        this.currentSound = null;
        this.volume = 0.4;
    }

    _ensureCtx() {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    stop() {
        this.nodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.nodes = [];
        if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
        this.currentSound = null;
    }

    setVolume(vol) {
        this.volume = vol / 100;
        if (this.gainNode) this.gainNode.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }

    play(type) {
        this.stop();
        this._ensureCtx();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.ctx.destination);
        this.currentSound = type;

        switch(type) {
            case 'brown': this._playBrownNoise(); break;
            case 'rain': this._playRain(); break;
            case 'forest': this._playForest(); break;
            case 'cafe': this._playCafe(); break;
        }
    }

    // Brown noise: integrate white noise to get -6dB/oct slope
    _playBrownNoise() {
        const bufferSize = this.ctx.sampleRate * 4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // amplify
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.gainNode);
        source.start();
        this.nodes.push(source);
    }

    // Rain: white noise + bandpass shaping
    _playRain() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Multi-band shaping for rain texture
        const lowPass = this.ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 3500;
        lowPass.Q.value = 0.5;

        const highPass = this.ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 350;

        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(this.gainNode);
        source.start();
        this.nodes.push(source);

        // Add periodic drip-like LFO tremolo
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 4;
        lfoGain.gain.value = 0.15;
        lfo.connect(lfoGain);
        lfoGain.connect(this.gainNode.gain);
        lfo.start();
        this.nodes.push(lfo);
    }

    // Forest: layered sine waves (crickets, wind)
    _playForest() {
        // Wind layer - filtered noise
        const bufSize = this.ctx.sampleRate * 3;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

        const windSrc = this.ctx.createBufferSource();
        windSrc.buffer = buf;
        windSrc.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 600;
        windFilter.Q.value = 0.4;
        windSrc.connect(windFilter);
        windFilter.connect(this.gainNode);
        windSrc.start();
        this.nodes.push(windSrc);

        // Cricket-like chirps with oscillators
        [4200, 4800, 5100].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            oscGain.gain.value = 0.005;

            const lfo = this.ctx.createOscillator();
            const lfoG = this.ctx.createGain();
            lfo.type = 'square';
            lfo.frequency.value = 8 + i * 2.5;
            lfoG.gain.value = 0.005;
            lfo.connect(lfoG);
            lfoG.connect(oscGain.gain);
            lfo.start();
            this.nodes.push(lfo);

            osc.connect(oscGain);
            oscGain.connect(this.gainNode);
            osc.start();
            this.nodes.push(osc);
        });
    }

    // Cafe: filtered noise + periodic soft knocking pulses
    _playCafe() {
        const bufSize = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 0.8;

        src.connect(filter);
        filter.connect(this.gainNode);
        src.start();
        this.nodes.push(src);

        // Occasional muffled knock pulses
        const schedulePulse = () => {
            if (!this.currentSound) return;
            const delay = 1.5 + Math.random() * 3;
            const freq = 200 + Math.random() * 100;
            const when = this.ctx.currentTime + delay;

            const osc = this.ctx.createOscillator();
            const env = this.ctx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            env.gain.setValueAtTime(0, when);
            env.gain.linearRampToValueAtTime(0.08, when + 0.01);
            env.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
            osc.connect(env);
            env.connect(this.gainNode);
            osc.start(when);
            osc.stop(when + 0.35);
            this.nodes.push(osc);

            setTimeout(schedulePulse, delay * 1000 - 200);
        };
        schedulePulse();
    }
}

// Export singleton for use in sidepanel.js
window.MioBookAmbient = new AmbientSoundEngine();
