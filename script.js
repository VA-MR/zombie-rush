/**
 * ZOMBIE RUSH - Continuous Game Mode
 * A crash-style casino game with Plants vs Zombies theme
 * Zombies spawn continuously on random lanes
 */

// ============================================
// GAME CONFIGURATION
// ============================================
const GameConfig = {
    targetDuration: 10,  // All lanes reach max in 10 seconds
    lanes: {
        safe: {
            maxMultiplier: 4.0,
            houseEdge: 0.05,
            speedConstant: 0.1386     // ln(4)/10 - reaches 4x in 10s
        },
        medium: {
            maxMultiplier: 10.0,
            houseEdge: 0.05,
            speedConstant: 0.2303     // ln(10)/10 - reaches 10x in 10s
        },
        wild: {
            maxMultiplier: 50.0,
            houseEdge: 0.05,
            speedConstant: 0.3912     // ln(50)/10 - reaches 50x in 10s
        }
    },
    // Continuous mode settings
    safeZoneDuration: 3500,   // 3.5 seconds in safe zone
    safeZonePercent: 0.20,    // Visual: first 20% of track
    respawnDelay: 500,        // 0.5s delay between waves
    defaultBetAmount: 10,     // $10 default bet
    spawnChancePerLane: 0.5,  // 50% chance each lane spawns
    // Other settings
    debug: {
        forceCrashPoint: null,
        showCrashInConsole: false
    },
    updateInterval: 50,       // Multiplier update interval in ms
    projectileInterval: 500   // Bomb shooting interval in ms
};

// ============================================
// LANE STATES
// ============================================
const LaneState = {
    IDLE: 'idle',           // Lane empty, no zombie
    SAFE_ZONE: 'safe_zone', // Zombie in safe zone, betting allowed
    ACTIVE: 'active',       // Zombie past safe zone, crash possible
    CRASHED: 'crashed',     // Zombie exploded, waiting for wave end
    WAITING: 'waiting'      // Waiting for next spawn
};

// ============================================
// ZOMBIE TYPES (for single/double lane modes)
// ============================================
const ZombieTypes = {
    slow: {
        name: 'SLOW',
        emoji: '🐢',
        configKey: 'safe',  // Uses safe lane config
        color: 'safe'
    },
    medium: {
        name: 'MEDIUM',
        emoji: '🏃',
        configKey: 'medium',
        color: 'medium'
    },
    wild: {
        name: 'WILD',
        emoji: '⚡',
        configKey: 'wild',
        color: 'wild'
    }
};

// ============================================
// AMBIENT MUSIC SYSTEM
// ============================================
const AmbientMusic = {
    audioContext: null,
    masterGain: null,
    isPlaying: false,
    oscillators: [],
    intervals: [],
    
    // Initialize the audio context
    init() {
        if (this.audioContext) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.audioContext.destination);
    },
    
    // Create a soft pad/drone sound
    createPad(frequency, detune = 0) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;
        
        gain.gain.value = 0.08;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        this.oscillators.push({ osc, gain, filter });
        
        return { osc, gain, filter };
    },
    
    // Create atmospheric chime
    playChime() {
        if (!this.isPlaying) return;
        
        const notes = [523.25, 659.25, 783.99, 880, 1046.5]; // C5, E5, G5, A5, C6
        const freq = notes[Math.floor(Math.random() * notes.length)];
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.04, this.audioContext.currentTime, 0.1);
        gain.gain.setTargetAtTime(0, this.audioContext.currentTime + 0.5, 0.8);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 3);
    },
    
    // Create subtle ambient texture
    createTexture() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.value = 110; // Low A
        
        // Slow LFO for movement
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        lfoGain.gain.value = 20;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 2;
        
        gain.gain.value = 0.05;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        this.oscillators.push({ osc, gain, filter, lfo, lfoGain });
        
        return { osc, gain };
    },
    
    // Start the ambient music
    start() {
        if (this.isPlaying) return;
        
        this.init();
        
        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        
        // Fade in master volume
        this.masterGain.gain.setTargetAtTime(0.6, this.audioContext.currentTime, 0.5);
        
        // Create layered pads (soft drone chord)
        this.createPad(65.41);    // C2
        this.createPad(82.41);    // E2
        this.createPad(98);       // G2
        this.createPad(130.81, 5); // C3 with slight detune
        
        // Create ambient texture
        this.createTexture();
        
        // Schedule random chimes
        const chimeInterval = setInterval(() => {
            if (this.isPlaying && Math.random() > 0.5) {
                this.playChime();
            }
        }, 3000);
        this.intervals.push(chimeInterval);
        
        // Occasional extra chime
        const extraChimeInterval = setInterval(() => {
            if (this.isPlaying && Math.random() > 0.7) {
                setTimeout(() => this.playChime(), 500);
            }
        }, 5000);
        this.intervals.push(extraChimeInterval);
        
        console.log('🎵 Ambient music started');
    },
    
    // Stop the ambient music
    stop() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        // Fade out master volume
        this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.3);
        
        // Stop all oscillators after fade
        setTimeout(() => {
            this.oscillators.forEach(({ osc, lfo }) => {
                try {
                    osc.stop();
                    if (lfo) lfo.stop();
                } catch (e) {}
            });
            this.oscillators = [];
        }, 1000);
        
        // Clear intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        
        console.log('🎵 Ambient music stopped');
    },
    
    // Toggle music on/off
    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
        return this.isPlaying;
    }
};

// ============================================
// GAME STATE
// ============================================
const GameState = {
    balance: 1000.00,
    isRunning: false,
    isContinuousMode: false,
    currentMode: 'triple',  // 'single', 'double', 'triple'
    waveSpawnScheduled: false,  // Prevents multiple wave spawn scheduling
    lanes: {
        safe: {
            state: LaneState.IDLE,
            bet: 0,
            crashPoint: 1.00,
            currentMultiplier: 1.00,
            zombiePosition: 100,
            history: [],
            projectileInterval: null,
            explosionTimeout: null,   // Track explosion timeout to clear on respawn
            spawnTime: null,       // When zombie spawned
            activeTime: null,      // When zombie entered active zone
            zombieType: 'slow'     // Current zombie type (for single/double modes)
        },
        medium: {
            state: LaneState.IDLE,
            bet: 0,
            crashPoint: 1.00,
            currentMultiplier: 1.00,
            zombiePosition: 100,
            history: [],
            projectileInterval: null,
            explosionTimeout: null,
            spawnTime: null,
            activeTime: null,
            zombieType: 'medium'
        },
        wild: {
            state: LaneState.IDLE,
            bet: 0,
            crashPoint: 1.00,
            currentMultiplier: 1.00,
            zombiePosition: 100,
            history: [],
            projectileInterval: null,
            explosionTimeout: null,
            spawnTime: null,
            activeTime: null,
            zombieType: 'wild'
        }
    }
};

// ============================================
// DOM ELEMENTS
// ============================================
const DOM = {
    balance: document.getElementById('balance'),
    statusText: document.getElementById('status-text'),
    btnStart: document.getElementById('btn-start'),
    btnStop: document.getElementById('btn-stop'),
    betAmountDisplay: document.getElementById('bet-amount-display'),
    adminToggle: document.getElementById('admin-toggle'),
    mathToggle: document.getElementById('math-toggle'),
    adminOverlay: document.getElementById('admin-overlay'),
    adminClose: document.getElementById('admin-close'),
    btnApply: document.getElementById('btn-apply'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    resultPopup: document.getElementById('result-popup'),
    resultIcon: document.getElementById('result-icon'),
    resultText: document.getElementById('result-text'),
    resultAmount: document.getElementById('result-amount'),
    lanesContainer: document.querySelector('.lanes-container'),
    modeTabs: document.querySelectorAll('.mode-tab'),
    musicToggle: document.getElementById('music-toggle'),
    musicIcon: document.getElementById('music-icon'),
    musicLabel: document.getElementById('music-label'),
    lanes: {
        safe: {
            element: document.querySelector('[data-lane="safe"]'),
            gameArea: document.getElementById('game-area-safe'),
            multiplier: document.getElementById('multiplier-safe'),
            zombieContainer: document.getElementById('zombie-container-safe'),
            zombie: document.getElementById('zombie-safe'),
            explosion: document.getElementById('explosion-safe'),
            potential: document.getElementById('potential-safe'),
            bubbles: document.getElementById('bubbles-safe'),
            betBadge: document.getElementById('bet-badge-safe'),
            laneLabel: document.getElementById('lane-label-safe'),
            laneInfo: document.getElementById('lane-info-safe'),
            laneBackground: document.querySelector('[data-lane="safe"] .lane-background'),
            safeZone: null  // Will be created dynamically
        },
        medium: {
            element: document.querySelector('[data-lane="medium"]'),
            gameArea: document.getElementById('game-area-medium'),
            multiplier: document.getElementById('multiplier-medium'),
            zombieContainer: document.getElementById('zombie-container-medium'),
            zombie: document.getElementById('zombie-medium'),
            explosion: document.getElementById('explosion-medium'),
            potential: document.getElementById('potential-medium'),
            bubbles: document.getElementById('bubbles-medium'),
            betBadge: document.getElementById('bet-badge-medium'),
            laneLabel: document.getElementById('lane-label-medium'),
            laneInfo: document.getElementById('lane-info-medium'),
            laneBackground: document.querySelector('[data-lane="medium"] .lane-background'),
            safeZone: null
        },
        wild: {
            element: document.querySelector('[data-lane="wild"]'),
            gameArea: document.getElementById('game-area-wild'),
            multiplier: document.getElementById('multiplier-wild'),
            zombieContainer: document.getElementById('zombie-container-wild'),
            zombie: document.getElementById('zombie-wild'),
            explosion: document.getElementById('explosion-wild'),
            potential: document.getElementById('potential-wild'),
            bubbles: document.getElementById('bubbles-wild'),
            betBadge: document.getElementById('bet-badge-wild'),
            laneLabel: document.getElementById('lane-label-wild'),
            laneInfo: document.getElementById('lane-info-wild'),
            laneBackground: document.querySelector('[data-lane="wild"] .lane-background'),
            safeZone: null
        }
    },
    admin: {
        rtpSafe: document.getElementById('rtp-safe'),
        rtpMedium: document.getElementById('rtp-medium'),
        rtpWild: document.getElementById('rtp-wild'),
        edgeDisplaySafe: document.getElementById('edge-display-safe'),
        edgeDisplayMedium: document.getElementById('edge-display-medium'),
        edgeDisplayWild: document.getElementById('edge-display-wild'),
        volatilitySafe: document.getElementById('volatility-safe'),
        volatilityMedium: document.getElementById('volatility-medium'),
        volatilityWild: document.getElementById('volatility-wild'),
        forceCrash: document.getElementById('force-crash'),
        showCrash: document.getElementById('show-crash')
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatMoney(amount) {
    return amount.toFixed(2);
}

function updateBalance() {
    DOM.balance.textContent = formatMoney(GameState.balance);
}

/**
 * Calculate crash point for a lane using provably-fair formula
 */
function calculateCrashPoint(laneName) {
    const config = GameConfig.lanes[laneName];
    
    if (GameConfig.debug.forceCrashPoint) {
        return Math.min(GameConfig.debug.forceCrashPoint, config.maxMultiplier);
    }
    
    const random = Math.random();
    const safeRandom = Math.max(random, 0.0001);
    const crashPoint = (1 - config.houseEdge) / safeRandom;
    
    return Math.min(crashPoint, config.maxMultiplier);
}

/**
 * Calculate crash point for a zombie type (used in single/double modes)
 */
function calculateCrashPointForType(zombieType) {
    const configKey = ZombieTypes[zombieType].configKey;
    const config = GameConfig.lanes[configKey];
    
    if (GameConfig.debug.forceCrashPoint) {
        return Math.min(GameConfig.debug.forceCrashPoint, config.maxMultiplier);
    }
    
    const random = Math.random();
    const safeRandom = Math.max(random, 0.0001);
    const crashPoint = (1 - config.houseEdge) / safeRandom;
    
    return Math.min(crashPoint, config.maxMultiplier);
}

/**
 * Calculate multiplier based on elapsed time
 */
function calculateMultiplier(elapsedTime, speedConstant) {
    return Math.pow(Math.E, speedConstant * elapsedTime / 1000);
}

/**
 * Create confetti effect
 */
function createConfetti() {
    const colors = ['#ffd700', '#ff6b35', '#4ade80', '#a855f7', '#ef4444'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 3000);
        }, i * 30);
    }
}

// ============================================
// MODE SYSTEM
// ============================================

/**
 * Get active lane names based on current mode
 */
function getActiveLanes() {
    switch (GameState.currentMode) {
        case 'single':
            return ['safe'];  // Only use 'safe' lane DOM, but with dynamic zombie types
        case 'double':
            return ['safe', 'medium'];  // Use two lanes with dynamic zombie types
        case 'triple':
        default:
            return ['safe', 'medium', 'wild'];  // All three with fixed types
    }
}

/**
 * Get a random zombie type
 */
function getRandomZombieType() {
    const types = ['slow', 'medium', 'wild'];
    return types[Math.floor(Math.random() * types.length)];
}

/**
 * Get config for a zombie type (maps to lane config)
 */
function getZombieConfig(zombieType) {
    const configKey = ZombieTypes[zombieType].configKey;
    return GameConfig.lanes[configKey];
}

/**
 * Update lane visual to reflect zombie type
 */
function updateLaneZombieType(laneName, zombieType) {
    const dom = DOM.lanes[laneName];
    const state = GameState.lanes[laneName];
    const typeInfo = ZombieTypes[zombieType];
    const config = getZombieConfig(zombieType);
    
    state.zombieType = zombieType;
    
    // Update lane label
    dom.laneLabel.textContent = `${typeInfo.emoji} ${typeInfo.name}`;
    dom.laneLabel.className = `lane-label type-${typeInfo.color}`;
    
    // Update lane info
    dom.laneInfo.textContent = `Max ${config.maxMultiplier}x`;
    
    // Update zombie glow class
    dom.zombie.classList.remove('zombie-slow', 'zombie-medium', 'zombie-wild');
    dom.zombie.classList.add(`zombie-${zombieType}`);
    
    // Update lane border color class
    dom.element.classList.remove('zombie-type-slow', 'zombie-type-medium', 'zombie-type-wild');
    dom.element.classList.add(`zombie-type-${zombieType}`);
    
    // Update background based on zombie type
    updateLaneBackground(laneName, zombieType);
}

/**
 * Update lane background and max multiplier indicator
 */
function updateLaneBackground(laneName, zombieType) {
    const dom = DOM.lanes[laneName];
    const config = getZombieConfig(zombieType);
    
    // Map zombie type to background class
    const bgMap = {
        'slow': 'safe-bg',
        'medium': 'medium-bg',
        'wild': 'wild-bg'
    };
    const newBgClass = bgMap[zombieType] || 'safe-bg';
    
    // Only change if different (avoids animation restart)
    const currentBgClasses = ['safe-bg', 'medium-bg', 'wild-bg'].filter(cls => 
        dom.laneBackground.classList.contains(cls)
    );
    
    if (currentBgClasses.length !== 1 || currentBgClasses[0] !== newBgClass) {
        // Remove old background classes
        dom.laneBackground.classList.remove('safe-bg', 'medium-bg', 'wild-bg');
        
        // Force animation restart by briefly removing animation
        dom.laneBackground.style.animation = 'none';
        void dom.laneBackground.offsetWidth; // Force reflow
        dom.laneBackground.style.animation = '';
        
        // Add new background class
        dom.laneBackground.classList.add(newBgClass);
    }
    
    // Update or create max multiplier indicator
    let maxIndicator = dom.laneBackground.querySelector('.max-multiplier-indicator');
    if (!maxIndicator) {
        maxIndicator = document.createElement('div');
        maxIndicator.className = 'max-multiplier-indicator';
        dom.laneBackground.appendChild(maxIndicator);
    }
    
    maxIndicator.innerHTML = `<span class="max-value">${config.maxMultiplier}x</span><span class="max-label">MAX</span>`;
    maxIndicator.className = `max-multiplier-indicator indicator-${zombieType}`;
}

/**
 * Reset lane to default appearance (for triple mode)
 */
function resetLaneDefaultAppearance(laneName) {
    const dom = DOM.lanes[laneName];
    const defaultLabels = {
        safe: { emoji: '🐢', name: 'SLOW', type: 'slow' },
        medium: { emoji: '🏃', name: 'MEDIUM', type: 'medium' },
        wild: { emoji: '⚡', name: 'WILD', type: 'wild' }
    };
    
    const defaults = defaultLabels[laneName];
    const config = GameConfig.lanes[laneName];
    
    dom.laneLabel.textContent = `${defaults.emoji} ${defaults.name}`;
    dom.laneLabel.className = `lane-label ${laneName}-label`;
    dom.laneInfo.textContent = `Max ${config.maxMultiplier}x`;
    
    // Apply zombie type class for visual distinction
    dom.zombie.classList.remove('zombie-slow', 'zombie-medium', 'zombie-wild');
    dom.zombie.classList.add(`zombie-${defaults.type}`);
    
    dom.element.classList.remove('zombie-type-slow', 'zombie-type-medium', 'zombie-type-wild');
    
    // Update background for zombie type
    updateLaneBackground(laneName, defaults.type);
    
    GameState.lanes[laneName].zombieType = defaults.type;
}

/**
 * Switch game mode
 */
function switchMode(newMode) {
    if (GameState.isRunning) {
        showNotification('Stop the game before changing modes!', 'error');
        return;
    }
    
    if (GameState.currentMode === newMode) return;
    
    GameState.currentMode = newMode;
    
    // Update tab UI
    DOM.modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === newMode);
    });
    
    // Update lanes container class for styling
    DOM.lanesContainer.classList.remove('single-mode', 'double-mode', 'triple-mode');
    DOM.lanesContainer.classList.add(`${newMode}-mode`);
    
    // Show/hide lanes based on mode
    const activeLanes = getActiveLanes();
    const allLanes = ['safe', 'medium', 'wild'];
    
    allLanes.forEach(laneName => {
        const dom = DOM.lanes[laneName];
        if (activeLanes.includes(laneName)) {
            dom.element.classList.remove('lane-hidden');
        } else {
            dom.element.classList.add('lane-hidden');
        }
    });
    
    // Reset lane appearances
    if (newMode === 'triple') {
        // Triple mode: reset to default fixed types
        allLanes.forEach(laneName => {
            resetLaneDefaultAppearance(laneName);
        });
    } else {
        // Single/Double mode: prepare for dynamic types
        activeLanes.forEach(laneName => {
            // Show generic label until zombie spawns
            const dom = DOM.lanes[laneName];
            dom.laneLabel.textContent = '🧟 LANE ' + (activeLanes.indexOf(laneName) + 1);
            dom.laneLabel.className = 'lane-label';
            dom.laneInfo.textContent = 'Waiting...';
        });
    }
    
    console.log(`Mode switched to: ${newMode}`);
}

// ============================================
// SAFE ZONE VISUAL
// ============================================

function createSafeZoneMarkers() {
    ['safe', 'medium', 'wild'].forEach(laneName => {
        const dom = DOM.lanes[laneName];
        const gameArea = dom.gameArea;
        
        // Create safe zone overlay
        const safeZone = document.createElement('div');
        safeZone.className = 'safe-zone-marker';
        safeZone.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: ${GameConfig.safeZonePercent * 100}%;
            background: repeating-linear-gradient(
                -45deg,
                rgba(74, 222, 128, 0.1),
                rgba(74, 222, 128, 0.1) 10px,
                rgba(74, 222, 128, 0.2) 10px,
                rgba(74, 222, 128, 0.2) 20px
            );
            border-left: 3px dashed rgba(74, 222, 128, 0.6);
            pointer-events: none;
            z-index: 1;
        `;
        gameArea.appendChild(safeZone);
        dom.safeZone = safeZone;
        
        // Add cutoff line label
        const label = document.createElement('div');
        label.className = 'safe-zone-label';
        label.textContent = 'SAFE';
        label.style.cssText = `
            position: absolute;
            right: ${GameConfig.safeZonePercent * 100 - 2}%;
            top: 50%;
            transform: translateY(-50%) rotate(-90deg);
            font-size: 0.5rem;
            color: rgba(74, 222, 128, 0.8);
            font-family: var(--font-ui);
            letter-spacing: 2px;
            pointer-events: none;
            z-index: 1;
        `;
        gameArea.appendChild(label);
    });
}

// ============================================
// PROJECTILE SYSTEM
// ============================================

function fireBomb(laneName) {
    const dom = DOM.lanes[laneName];
    const state = GameState.lanes[laneName];
    
    if (state.state !== LaneState.ACTIVE || !GameState.isRunning) {
        return;
    }
    
    const gameArea = dom.gameArea;
    const plant = gameArea.querySelector('.plant');
    const zombieContainer = dom.zombieContainer;
    
    const gameAreaRect = gameArea.getBoundingClientRect();
    const plantRect = plant.getBoundingClientRect();
    const zombieRect = zombieContainer.getBoundingClientRect();
    
    const bomb = document.createElement('img');
    bomb.src = 'assets/bomb.svg';
    bomb.className = 'bomb';
    
    const startX = plantRect.right - gameAreaRect.left;
    const startY = plantRect.top + plantRect.height / 2 - gameAreaRect.top;
    const endX = zombieRect.left - gameAreaRect.left + zombieRect.width / 2;
    const endY = zombieRect.top + zombieRect.height / 2 - gameAreaRect.top;
    
    bomb.style.left = startX + 'px';
    bomb.style.top = startY + 'px';
    bomb.style.transform = 'translateY(-50%)';
    
    gameArea.appendChild(bomb);
    
    const travelTime = 300;
    const startTime = performance.now();
    
    function animateBomb(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / travelTime, 1);
        
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        
        bomb.style.left = currentX + 'px';
        bomb.style.top = currentY + 'px';
        bomb.style.transform = `translateY(-50%) rotate(${progress * 360}deg)`;
        
        if (progress < 1) {
            requestAnimationFrame(animateBomb);
        } else {
            bomb.remove();
        }
    }
    
    requestAnimationFrame(animateBomb);
}

function startProjectiles(laneName) {
    const state = GameState.lanes[laneName];
    
    fireBomb(laneName);
    state.projectileInterval = setInterval(() => {
        fireBomb(laneName);
    }, GameConfig.projectileInterval);
}

function stopProjectiles(laneName) {
    const state = GameState.lanes[laneName];
    
    if (state.projectileInterval) {
        clearInterval(state.projectileInterval);
        state.projectileInterval = null;
    }
}

// ============================================
// EXPLOSION SYSTEM
// ============================================

function showExplosion(laneName) {
    const dom = DOM.lanes[laneName];
    const state = GameState.lanes[laneName];
    
    dom.zombie.classList.add('hidden');
    dom.explosion.classList.add('active');
    
    // Clear any existing explosion timeout
    if (state.explosionTimeout) {
        clearTimeout(state.explosionTimeout);
    }
    
    // Store the timeout so it can be cleared on respawn
    state.explosionTimeout = setTimeout(() => {
        dom.explosion.classList.remove('active');
        state.explosionTimeout = null;
    }, 1000);
}

function hideExplosion(laneName) {
    const dom = DOM.lanes[laneName];
    const state = GameState.lanes[laneName];
    
    // Clear the explosion timeout if it exists
    if (state.explosionTimeout) {
        clearTimeout(state.explosionTimeout);
        state.explosionTimeout = null;
    }
    
    dom.explosion.classList.remove('active');
}

// ============================================
// HISTORY SYSTEM
// ============================================

function addToHistory(laneName, result, multiplier) {
    const state = GameState.lanes[laneName];
    const bubbles = DOM.lanes[laneName].bubbles;
    
    let bubbleClass = 'bubble-loss';
    let multiplierText = multiplier.toFixed(2) + 'x';
    let resultLabel = '';
    
    if (result === 'jackpot') {
        bubbleClass = 'bubble-jackpot';
        multiplierText = multiplier.toFixed(1) + 'x';
        resultLabel = '🏆 JACKPOT';
    } else if (result === 'win') {
        bubbleClass = 'bubble-win';
        resultLabel = '💰 WIN';
    } else if (result === 'crash') {
        bubbleClass = 'bubble-loss';
        resultLabel = '💀 CRASH';
    }
    
    const bubble = document.createElement('div');
    bubble.className = `history-bubble ${bubbleClass}`;
    bubble.innerHTML = `
        <span class="bubble-multiplier">${multiplierText}</span>
        <span class="bubble-result">${resultLabel}</span>
    `;
    
    state.history.unshift({ result, multiplier });
    
    if (state.history.length > 10) {
        state.history.pop();
    }
    
    bubbles.insertBefore(bubble, bubbles.firstChild);
    
    while (bubbles.children.length > 10) {
        bubbles.removeChild(bubbles.lastChild);
    }
}

function clearAllHistory() {
    ['safe', 'medium', 'wild'].forEach(laneName => {
        GameState.lanes[laneName].history = [];
        DOM.lanes[laneName].bubbles.innerHTML = '';
    });
}

// ============================================
// CLICK-TO-BET/CASH-OUT SYSTEM
// ============================================

function handleLaneClick(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    if (!GameState.isRunning) {
        showNotification('Start the game first!', 'error');
        return;
    }
    
    // Bet on lane (if in idle or safe_zone state)
    if (state.state === LaneState.SAFE_ZONE && state.bet === 0) {
        placeBet(laneName);
    }
    // Cash out (if in active state with a bet)
    else if (state.state === LaneState.ACTIVE && state.bet > 0) {
        cashOut(laneName);
    }
}

function placeBet(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    const betAmount = GameConfig.defaultBetAmount;
    
    if (betAmount > GameState.balance) {
        showNotification('Insufficient balance!', 'error');
        return;
    }
    
    if (state.bet > 0) {
        showNotification('Already bet on this lane!', 'error');
        return;
    }
    
    // Deduct bet from balance
    GameState.balance -= betAmount;
    updateBalance();
    
    // Update state
    state.bet = betAmount;
    
    // Update UI - strong visual feedback
    dom.element.classList.add('has-bet');
    dom.element.classList.remove('no-bet');
    dom.potential.innerHTML = `<span class="bet-value">$${formatMoney(betAmount)}</span>`;
    dom.potential.style.color = '#ffd700';
    
    // Update bet badge
    if (dom.betBadge) {
        dom.betBadge.textContent = `BET: $${betAmount}`;
    }
    
    // Get zombie type name for notification
    const typeInfo = ZombieTypes[state.zombieType];
    const displayName = GameState.currentMode === 'triple' ? laneName.toUpperCase() : typeInfo.name;
    
    showNotification(`$${formatMoney(betAmount)} bet on ${displayName}!`, 'success');
}

function cashOut(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    if (state.state !== LaneState.ACTIVE || state.bet === 0) {
        return;
    }
    
    const winAmount = state.bet * state.currentMultiplier;
    
    // Add winnings to balance
    GameState.balance += winAmount;
    updateBalance();
    
    // Clear bet
    const profit = winAmount - state.bet;
    state.bet = 0;
    
    // Update UI
    dom.element.classList.remove('has-bet');
    dom.element.classList.add('no-bet');
    dom.element.classList.add('flash-win');
    setTimeout(() => dom.element.classList.remove('flash-win'), 500);
    
    dom.potential.innerHTML = `Won: <span class="bet-value">+$${formatMoney(profit)}</span>`;
    dom.potential.style.color = '#ffd700';
    
    // Show win notification
    showResultPopup('win', `CASHED OUT at ${state.currentMultiplier.toFixed(2)}x`, winAmount);
    
    // Add to history
    addToHistory(laneName, 'win', state.currentMultiplier);
}

// ============================================
// WAVE SPAWNING SYSTEM
// ============================================

function spawnNewWave() {
    if (!GameState.isRunning) return;
    
    const activeLanes = getActiveLanes();
    let spawnedLanes = [];
    let spawnedTypes = [];
    
    if (GameState.currentMode === 'triple') {
        // Triple mode: original behavior - each lane has 50% chance
        activeLanes.forEach(laneName => {
            if (Math.random() < GameConfig.spawnChancePerLane) {
                spawnedLanes.push(laneName);
            }
        });
        
        // Ensure at least one lane spawns
        if (spawnedLanes.length === 0) {
            const randomLane = activeLanes[Math.floor(Math.random() * activeLanes.length)];
            spawnedLanes.push(randomLane);
        }
        
        // Spawn zombies with fixed types (lane determines type)
        spawnedLanes.forEach(laneName => {
            // In triple mode, zombie type matches lane name
            const fixedType = laneName === 'safe' ? 'slow' : (laneName === 'medium' ? 'medium' : 'wild');
            spawnZombie(laneName, fixedType);
            spawnedTypes.push(fixedType);
        });
    } else {
        // Single/Double mode: all active lanes always spawn, random zombie types
        activeLanes.forEach(laneName => {
            const randomType = getRandomZombieType();
            spawnZombie(laneName, randomType);
            spawnedLanes.push(laneName);
            spawnedTypes.push(randomType);
        });
    }
    
    // Set other lanes to idle (only matters for triple mode)
    activeLanes.forEach(laneName => {
        if (!spawnedLanes.includes(laneName)) {
            resetLaneToIdle(laneName);
        }
    });
    
    // Show wave announcement
    showWaveAnnouncement(spawnedTypes);
    
    if (GameConfig.debug.showCrashInConsole) {
        console.log('New wave spawned on:', spawnedLanes.join(', '));
    }
}

function spawnZombie(laneName, zombieType) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    // Set zombie type and get appropriate config
    state.zombieType = zombieType;
    const configKey = ZombieTypes[zombieType].configKey;
    const config = GameConfig.lanes[configKey];
    const typeInfo = ZombieTypes[zombieType];
    
    // Update lane visuals for zombie type (in single/double modes)
    if (GameState.currentMode !== 'triple') {
        updateLaneZombieType(laneName, zombieType);
    } else {
        // In triple mode, reset to default appearance
        resetLaneDefaultAppearance(laneName);
    }
    
    // Calculate crash point using the zombie type's config
    state.crashPoint = calculateCrashPointForType(zombieType);
    state.currentMultiplier = 1.00;
    state.zombiePosition = 90;
    state.spawnTime = Date.now();
    state.activeTime = null;
    state.bet = 0;
    
    // Set state to safe zone
    state.state = LaneState.SAFE_ZONE;
    
    // Reset zombie visibility and position
    dom.zombie.classList.remove('hidden', 'dead', 'winner');
    dom.zombieContainer.style.left = '90%';
    hideExplosion(laneName);
    
    // Add zombie type indicator badge
    addZombieTypeBadge(laneName, zombieType);
    
    // Update UI
    dom.multiplier.textContent = '1.00x';
    dom.multiplier.classList.remove('hot', 'danger');
    dom.element.classList.add('spawning');
    dom.element.classList.remove('has-bet', 'betting-closed', 'no-bet');
    dom.potential.textContent = 'Click to bet';
    dom.potential.style.color = '#ffd700';
    
    setTimeout(() => dom.element.classList.remove('spawning'), 300);
    
    if (GameConfig.debug.showCrashInConsole) {
        console.log(`${laneName.toUpperCase()} [${typeInfo.name}] crash point: ${state.crashPoint.toFixed(2)}x (max ${config.maxMultiplier}x)`);
    }
}

/**
 * Add a visual badge showing the zombie type above the zombie
 */
function addZombieTypeBadge(laneName, zombieType) {
    const dom = DOM.lanes[laneName];
    const container = dom.zombieContainer;
    const typeInfo = ZombieTypes[zombieType];
    const config = getZombieConfig(zombieType);
    
    // Remove existing badge if any
    const existingBadge = container.querySelector('.zombie-type-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Create new badge
    const badge = document.createElement('div');
    badge.className = `zombie-type-badge badge-${typeInfo.color}`;
    badge.innerHTML = `${typeInfo.emoji}<span class="badge-max">${config.maxMultiplier}x</span>`;
    container.appendChild(badge);
}

function resetLaneToIdle(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    state.state = LaneState.IDLE;
    state.bet = 0;
    state.currentMultiplier = 1.00;
    state.zombiePosition = 100;
    state.spawnTime = null;
    state.activeTime = null;
    
    // Hide zombie
    dom.zombie.classList.add('hidden');
    dom.zombie.classList.remove('zombie-slow', 'zombie-medium', 'zombie-wild');
    dom.zombieContainer.style.left = '90%';
    hideExplosion(laneName);
    
    // Remove zombie type badge
    const existingBadge = dom.zombieContainer.querySelector('.zombie-type-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Update UI
    dom.multiplier.textContent = '—';
    dom.multiplier.classList.remove('hot', 'danger');
    dom.element.classList.remove('has-bet', 'spawning', 'betting-closed', 'no-bet');
    dom.element.classList.remove('zombie-type-slow', 'zombie-type-medium', 'zombie-type-wild');
    dom.potential.textContent = '';
    dom.potential.style.color = '';
}

// ============================================
// CONTINUOUS GAME LOOP
// ============================================

let gameLoopInterval = null;

function startContinuousMode() {
    if (GameState.isRunning) return;
    
    GameState.isRunning = true;
    GameState.isContinuousMode = true;
    GameState.waveSpawnScheduled = false;
    
    DOM.btnStart.disabled = true;
    DOM.btnStart.style.display = 'none';
    DOM.btnStop.style.display = 'inline-block';
    DOM.statusText.textContent = 'Zombies are rushing! Click lanes to bet.';
    
    // Spawn first wave
    spawnNewWave();
    
    // Start game loop
    gameLoopInterval = setInterval(updateContinuousGame, GameConfig.updateInterval);
    
    console.log('🧟 Continuous mode started!');
}

function stopContinuousMode() {
    GameState.isRunning = false;
    GameState.isContinuousMode = false;
    GameState.waveSpawnScheduled = false;
    
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    
    // Stop all projectiles on all lanes (not just active ones)
    ['safe', 'medium', 'wild'].forEach(laneName => {
        stopProjectiles(laneName);
        resetLaneToIdle(laneName);
    });
    
    // Hide wave announcement
    const announcement = document.getElementById('wave-announcement');
    if (announcement) {
        announcement.classList.remove('active');
    }
    
    DOM.btnStart.disabled = false;
    DOM.btnStart.style.display = 'inline-block';
    DOM.btnStop.style.display = 'none';
    DOM.statusText.textContent = 'Game stopped. Click START to play!';
    
    console.log('🧟 Continuous mode stopped!');
}

function updateContinuousGame() {
    const currentTime = Date.now();
    let allLanesFinished = true;
    let anyLaneActive = false;
    
    const activeLanes = getActiveLanes();
    
    activeLanes.forEach(laneName => {
        const state = GameState.lanes[laneName];
        const dom = DOM.lanes[laneName];
        
        // Get config based on zombie type (not lane name)
        const configKey = ZombieTypes[state.zombieType].configKey;
        const config = GameConfig.lanes[configKey];
        
        // Skip idle lanes
        if (state.state === LaneState.IDLE) {
            return;
        }
        
        // Handle safe zone
        if (state.state === LaneState.SAFE_ZONE) {
            anyLaneActive = true;
            const safeZoneElapsed = currentTime - state.spawnTime;
            
            // Move zombie through safe zone (visual only)
            const safeZoneProgress = Math.min(safeZoneElapsed / GameConfig.safeZoneDuration, 1);
            // Move from 90% to 72% (safe zone end)
            const safeZoneEndPosition = 90 - (GameConfig.safeZonePercent * 80);
            state.zombiePosition = 90 - (safeZoneProgress * (90 - safeZoneEndPosition));
            dom.zombieContainer.style.left = state.zombiePosition + '%';
            
            // Check if safe zone time is over
            if (safeZoneElapsed >= GameConfig.safeZoneDuration) {
                // Transition to active state
                state.state = LaneState.ACTIVE;
                state.activeTime = currentTime;
                
                // Close betting for this lane
                dom.element.classList.add('betting-closed');
                if (state.bet === 0) {
                    dom.element.classList.add('no-bet');
                    dom.potential.textContent = 'No more bets';
                    dom.potential.style.color = '#ffd700';
                } else {
                    // Show the current bet value
                    dom.potential.innerHTML = `<span class="bet-value">$${formatMoney(state.bet)}</span>`;
                    dom.potential.style.color = '#ffd700';
                }
                
                // Start projectiles
                startProjectiles(laneName);
            }
            
            allLanesFinished = false;
            return;
        }
        
        // Handle active lane
        if (state.state === LaneState.ACTIVE) {
            anyLaneActive = true;
            const activeElapsed = currentTime - state.activeTime;
            
            // Calculate current multiplier using zombie type's config
            state.currentMultiplier = calculateMultiplier(activeElapsed, config.speedConstant);
            
            // Cap at max multiplier - jackpot!
            if (state.currentMultiplier >= config.maxMultiplier) {
                state.currentMultiplier = config.maxMultiplier;
                handleJackpot(laneName);
                return;
            }
            
            // Check for crash
            if (state.currentMultiplier >= state.crashPoint) {
                handleCrash(laneName);
                return;
            }
            
            // Update UI
            dom.multiplier.textContent = state.currentMultiplier.toFixed(2) + 'x';
            
            // Update multiplier color
            if (state.currentMultiplier > config.maxMultiplier * 0.7) {
                dom.multiplier.classList.add('danger');
                dom.multiplier.classList.remove('hot');
            } else if (state.currentMultiplier > config.maxMultiplier * 0.4) {
                dom.multiplier.classList.add('hot');
                dom.multiplier.classList.remove('danger');
            }
            
            // Update zombie position (continue from where safe zone ended)
            const safeZoneEndPosition = 90 - (GameConfig.safeZonePercent * 80);
            const activeProgress = (state.currentMultiplier - 1) / (config.maxMultiplier - 1);
            const remainingTrack = safeZoneEndPosition - 10; // From safe zone end to plant (10%)
            state.zombiePosition = safeZoneEndPosition - (activeProgress * remainingTrack);
            dom.zombieContainer.style.left = state.zombiePosition + '%';
            
            // Update potential win display - show growing bet value
            if (state.bet > 0) {
                const potentialWin = state.bet * state.currentMultiplier;
                dom.potential.innerHTML = `<span class="bet-value">$${formatMoney(potentialWin)}</span>`;
                dom.potential.style.color = '#ffd700';
            }
            
            allLanesFinished = false;
        }
        
        // Handle crashed/waiting lanes
        if (state.state === LaneState.CRASHED || state.state === LaneState.WAITING) {
            // Check if still waiting for other lanes
            anyLaneActive = true;
        }
    });
    
    // Check if all active lanes are finished (crashed or idle)
    if (allLanesFinished && anyLaneActive && !GameState.waveSpawnScheduled) {
        // All lanes in this wave are done, spawn new wave after delay
        GameState.waveSpawnScheduled = true;
        setTimeout(() => {
            if (GameState.isRunning) {
                GameState.waveSpawnScheduled = false;
                spawnNewWave();
            }
        }, GameConfig.respawnDelay);
    }
}

function handleCrash(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    // Stop projectiles
    stopProjectiles(laneName);
    
    // Show explosion
    showExplosion(laneName);
    
    // Update UI
    dom.multiplier.textContent = 'CRASH!';
    dom.multiplier.classList.add('danger');
    
    if (state.bet > 0) {
        dom.potential.innerHTML = `Lost: <span class="bet-value">$${formatMoney(state.bet)}</span>`;
        dom.potential.style.color = '#ffd700';
    }
    
    // Shake effect
    dom.element.classList.add('shake');
    dom.element.classList.add('flash-loss');
    setTimeout(() => {
        dom.element.classList.remove('shake');
        dom.element.classList.remove('flash-loss');
    }, 300);
    
    // Add to history
    addToHistory(laneName, 'crash', state.currentMultiplier);
    
    // Set state to crashed
    state.state = LaneState.CRASHED;
    state.bet = 0;
    dom.element.classList.remove('has-bet');
    dom.element.classList.add('no-bet');
    
    checkWaveEnd();
}

function handleJackpot(laneName) {
    const state = GameState.lanes[laneName];
    const dom = DOM.lanes[laneName];
    
    // Get config based on zombie type
    const configKey = ZombieTypes[state.zombieType].configKey;
    const config = GameConfig.lanes[configKey];
    
    // Stop projectiles
    stopProjectiles(laneName);
    
    // Victory animation
    dom.zombie.classList.add('winner');
    dom.zombieContainer.style.left = '10%';
    
    // Calculate winnings if bet was placed
    if (state.bet > 0) {
        const winAmount = state.bet * config.maxMultiplier;
        GameState.balance += winAmount;
        updateBalance();
        
        dom.potential.innerHTML = `Won: <span class="bet-value">$${formatMoney(winAmount)}</span>`;
        dom.potential.style.color = '#ffd700';
        
        createConfetti();
        showResultPopup('jackpot', `JACKPOT! ${config.maxMultiplier}x`, winAmount);
        addToHistory(laneName, 'jackpot', config.maxMultiplier);
    } else {
        dom.potential.textContent = 'JACKPOT! (no bet)';
        dom.potential.style.color = '#ffd700';
        addToHistory(laneName, 'jackpot', config.maxMultiplier);
    }
    
    // Update UI
    dom.multiplier.textContent = '🏆 JACKPOT!';
    
    // Set state to crashed (finished)
    state.state = LaneState.CRASHED;
    state.bet = 0;
    dom.element.classList.remove('has-bet');
    dom.element.classList.add('no-bet');
    
    checkWaveEnd();
}

function checkWaveEnd() {
    const activeLanes = getActiveLanes();
    const allFinished = activeLanes.every(laneName => {
        const state = GameState.lanes[laneName];
        return state.state === LaneState.IDLE || state.state === LaneState.CRASHED;
    });
    
    if (allFinished && GameState.isRunning && !GameState.waveSpawnScheduled) {
        // Spawn new wave after delay
        GameState.waveSpawnScheduled = true;
        setTimeout(() => {
            if (GameState.isRunning) {
                GameState.waveSpawnScheduled = false;
                spawnNewWave();
            }
        }, GameConfig.respawnDelay);
    }
}

// ============================================
// UI NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Brief visual feedback on status text
    const originalText = DOM.statusText.textContent;
    DOM.statusText.textContent = message;
    setTimeout(() => {
        if (GameState.isRunning) {
            DOM.statusText.textContent = 'Zombies are rushing! Click lanes to bet.';
        }
    }, 1500);
}

/**
 * Show wave announcement with zombie types
 * Stays visible until next wave spawns
 */
function showWaveAnnouncement(zombieTypes) {
    // Use existing wave announcement element from HTML
    let announcement = document.getElementById('wave-announcement');
    
    // Build the announcement content - format: x[multiplier] [name] Lane
    const typeInfoList = zombieTypes.map(type => {
        const info = ZombieTypes[type];
        const config = getZombieConfig(type);
        return `<span class="wave-zombie-tag type-${info.color}">${info.emoji} x${config.maxMultiplier} ${info.name} Lane</span>`;
    });
    
    announcement.innerHTML = `
        <div class="wave-announcement-content">
            <div class="wave-zombies">${typeInfoList.join('')}</div>
        </div>
    `;
    
    // Show with animation (stays visible until next wave)
    announcement.classList.remove('active');
    void announcement.offsetWidth; // Force reflow
    announcement.classList.add('active');
}

function showResultPopup(type, text, amount) {
    const popup = DOM.resultPopup;
    
    popup.className = 'result-popup active ' + type;
    
    if (type === 'win') {
        DOM.resultIcon.textContent = '💰';
    } else if (type === 'jackpot') {
        DOM.resultIcon.textContent = '🏆';
    } else {
        DOM.resultIcon.textContent = '💀';
    }
    
    DOM.resultText.textContent = text;
    DOM.resultAmount.textContent = '+$' + formatMoney(amount);
    
    setTimeout(() => {
        popup.classList.remove('active');
    }, 2500);
}

// ============================================
// ADMIN PANEL
// ============================================

function openAdminPanel() {
    DOM.adminOverlay.classList.add('active');
    
    // Set RTP values (RTP = 100 - houseEdge%)
    DOM.admin.rtpSafe.value = (100 - GameConfig.lanes.safe.houseEdge * 100).toFixed(1);
    DOM.admin.rtpMedium.value = (100 - GameConfig.lanes.medium.houseEdge * 100).toFixed(1);
    DOM.admin.rtpWild.value = (100 - GameConfig.lanes.wild.houseEdge * 100).toFixed(1);
    
    // Update house edge displays
    updateHouseEdgeDisplay('safe');
    updateHouseEdgeDisplay('medium');
    updateHouseEdgeDisplay('wild');
    
    // Set volatility (max multiplier) values
    DOM.admin.volatilitySafe.value = GameConfig.lanes.safe.maxMultiplier;
    DOM.admin.volatilityMedium.value = GameConfig.lanes.medium.maxMultiplier;
    DOM.admin.volatilityWild.value = GameConfig.lanes.wild.maxMultiplier;
    
    DOM.admin.showCrash.checked = GameConfig.debug.showCrashInConsole;
    
    // Add live RTP update listeners
    DOM.admin.rtpSafe.addEventListener('input', () => updateHouseEdgeDisplay('safe'));
    DOM.admin.rtpMedium.addEventListener('input', () => updateHouseEdgeDisplay('medium'));
    DOM.admin.rtpWild.addEventListener('input', () => updateHouseEdgeDisplay('wild'));
}

function updateHouseEdgeDisplay(lane) {
    const rtpInput = DOM.admin[`rtp${lane.charAt(0).toUpperCase() + lane.slice(1)}`];
    const edgeDisplay = DOM.admin[`edgeDisplay${lane.charAt(0).toUpperCase() + lane.slice(1)}`];
    
    const rtp = parseFloat(rtpInput.value) || 95;
    const houseEdge = 100 - rtp;
    edgeDisplay.textContent = houseEdge.toFixed(1) + '%';
    
    // Color code based on house edge
    if (houseEdge <= 3) {
        edgeDisplay.style.borderColor = 'rgba(74, 222, 128, 0.6)';
        edgeDisplay.style.color = '#4ade80';
    } else if (houseEdge <= 7) {
        edgeDisplay.style.borderColor = 'rgba(251, 191, 36, 0.6)';
        edgeDisplay.style.color = '#fbbf24';
    } else {
        edgeDisplay.style.borderColor = 'rgba(239, 68, 68, 0.6)';
        edgeDisplay.style.color = '#ef4444';
    }
}

function closeAdminPanel() {
    DOM.adminOverlay.classList.remove('active');
}

function applyAdminChanges() {
    // Get RTP values and convert to house edge
    const rtpSafe = parseFloat(DOM.admin.rtpSafe.value) || 95;
    const rtpMedium = parseFloat(DOM.admin.rtpMedium.value) || 95;
    const rtpWild = parseFloat(DOM.admin.rtpWild.value) || 95;
    
    // Update house edges (houseEdge = 1 - RTP/100)
    GameConfig.lanes.safe.houseEdge = (100 - rtpSafe) / 100;
    GameConfig.lanes.medium.houseEdge = (100 - rtpMedium) / 100;
    GameConfig.lanes.wild.houseEdge = (100 - rtpWild) / 100;
    
    // Get volatility (max multiplier) values
    const newMaxSafe = parseFloat(DOM.admin.volatilitySafe.value) || 4;
    const newMaxMedium = parseFloat(DOM.admin.volatilityMedium.value) || 10;
    const newMaxWild = parseFloat(DOM.admin.volatilityWild.value) || 50;
    
    GameConfig.lanes.safe.maxMultiplier = newMaxSafe;
    GameConfig.lanes.medium.maxMultiplier = newMaxMedium;
    GameConfig.lanes.wild.maxMultiplier = newMaxWild;
    
    // Recalculate speed constants so all lanes reach max in 10 seconds
    GameConfig.lanes.safe.speedConstant = Math.log(newMaxSafe) / GameConfig.targetDuration;
    GameConfig.lanes.medium.speedConstant = Math.log(newMaxMedium) / GameConfig.targetDuration;
    GameConfig.lanes.wild.speedConstant = Math.log(newMaxWild) / GameConfig.targetDuration;
    
    // Update debug settings
    const forceCrash = parseFloat(DOM.admin.forceCrash.value);
    GameConfig.debug.forceCrashPoint = isNaN(forceCrash) ? null : forceCrash;
    GameConfig.debug.showCrashInConsole = DOM.admin.showCrash.checked;
    
    // Update lane info displays
    document.querySelector('[data-lane="safe"] .lane-info').textContent = `Max ${newMaxSafe}x`;
    document.querySelector('[data-lane="medium"] .lane-info').textContent = `Max ${newMaxMedium}x`;
    document.querySelector('[data-lane="wild"] .lane-info').textContent = `Max ${newMaxWild}x`;
    
    console.log('Admin changes applied:', {
        safe: { rtp: rtpSafe + '%', houseEdge: GameConfig.lanes.safe.houseEdge, maxMultiplier: newMaxSafe },
        medium: { rtp: rtpMedium + '%', houseEdge: GameConfig.lanes.medium.houseEdge, maxMultiplier: newMaxMedium },
        wild: { rtp: rtpWild + '%', houseEdge: GameConfig.lanes.wild.houseEdge, maxMultiplier: newMaxWild }
    });
    showNotification('Settings updated!', 'success');
    closeAdminPanel();
}

// ============================================
// EVENT LISTENERS
// ============================================

function toggleMusic() {
    const isPlaying = AmbientMusic.toggle();
    
    if (isPlaying) {
        DOM.musicToggle.classList.add('active');
        DOM.musicIcon.textContent = '🎵';
        DOM.musicLabel.textContent = 'Music On';
    } else {
        DOM.musicToggle.classList.remove('active');
        DOM.musicIcon.textContent = '🔇';
        DOM.musicLabel.textContent = 'Music Off';
    }
}

function initEventListeners() {
    // Music toggle
    if (DOM.musicToggle) {
        DOM.musicToggle.addEventListener('click', toggleMusic);
    }
    
    // Start/Stop buttons
    DOM.btnStart.addEventListener('click', startContinuousMode);
    
    if (DOM.btnStop) {
        DOM.btnStop.addEventListener('click', stopContinuousMode);
    }
    
    // Mode tab click handlers
    DOM.modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            switchMode(mode);
        });
    });
    
    // Lane click handlers for betting/cashing out
    ['safe', 'medium', 'wild'].forEach(laneName => {
        const dom = DOM.lanes[laneName];
        
        // Make game area clickable
        dom.gameArea.addEventListener('click', () => handleLaneClick(laneName));
        dom.gameArea.style.cursor = 'pointer';
        
        // Also make the whole lane content clickable
        dom.element.querySelector('.lane-content').addEventListener('click', (e) => {
            // Prevent double-handling if clicked on game area
            if (!e.target.closest('.game-area')) {
                handleLaneClick(laneName);
            }
        });
    });
    
    // Admin panel
    DOM.adminToggle.addEventListener('click', openAdminPanel);
    
    // Math verification panel
    DOM.mathToggle.addEventListener('click', () => {
        window.open('math-test-runner.html', '_blank');
    });
    DOM.adminClose.addEventListener('click', closeAdminPanel);
    DOM.adminOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.adminOverlay) {
            closeAdminPanel();
        }
    });
    DOM.btnApply.addEventListener('click', applyAdminChanges);
    DOM.btnClearHistory.addEventListener('click', () => {
        clearAllHistory();
        showNotification('History cleared!', 'success');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAdminPanel();
        }
        
        // M to toggle music
        if ((e.key === 'm' || e.key === 'M') && document.activeElement.tagName !== 'INPUT') {
            toggleMusic();
        }
        
        // Space to start/stop
        if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            if (!GameState.isRunning) {
                startContinuousMode();
            } else {
                stopContinuousMode();
            }
        }
        
        // 1, 2, 3 to bet/cashout lanes (only for active lanes)
        if (GameState.isRunning) {
            const activeLanes = getActiveLanes();
            if (e.key === '1' && activeLanes.length >= 1) handleLaneClick(activeLanes[0]);
            if (e.key === '2' && activeLanes.length >= 2) handleLaneClick(activeLanes[1]);
            if (e.key === '3' && activeLanes.length >= 3) handleLaneClick(activeLanes[2]);
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
    console.log('🧟 Zombie Rush - Continuous Mode initialized!');
    console.log('Click START to begin. Click on lanes to bet/cash out.');
    console.log('Keyboard: Space=Start/Stop, 1/2/3=Bet/CashOut, M=Music, Esc=Close panel');
    
    updateBalance();
    createSafeZoneMarkers();
    initEventListeners();
    
    // Hide stop button initially
    if (DOM.btnStop) {
        DOM.btnStop.style.display = 'none';
    }
    
    // Set initial mode (triple is default)
    DOM.lanesContainer.classList.add('triple-mode');
    
    // Initialize all lanes to idle with default appearances
    ['safe', 'medium', 'wild'].forEach(laneName => {
        resetLaneToIdle(laneName);
        resetLaneDefaultAppearance(laneName);
    });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
