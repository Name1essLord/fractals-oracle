const FRACTALS_CLASSIC = [
    { id: 'mandelbrot', name: 'Mandelbrot Set' },
    { id: 'julia', name: 'Julia Set' },
    { id: 'burning', name: 'Burning Ship' },
    { id: 'multibrot', name: 'Multibrot (n=3)' },
    { id: 'tricorn', name: 'Tricorn' },
    { id: 'celtic', name: 'Celtic' }
];
const FRACTALS_CHAOS = [
    { id: 'clifford', name: 'Clifford Attractor' },
    { id: 'dejong', name: 'De Jong Attractor' },
    { id: 'hopalong', name: 'Hopalong Attractor' },
    { id: 'pickover', name: 'Pickover Attractor' }
];

let state = {
    mode: 'classic',
    type: 'mandelbrot',
    palette: 0,
    inputMode: 'date',
    seedValue: Date.now().toString(),
    soundEnabled: false
};

const glCanvas = document.getElementById('glCanvas');
const attrCanvas = document.getElementById('attractorCanvas');
const ctxAttr = attrCanvas.getContext('2d');
const selectType = document.getElementById('selectType');
const seedInput = document.getElementById('seedInput');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');

let gl = null;
let prog = null;
let uniformLocs = null;
let viewZoom = 1.0;
let viewCenter = [0, 0];
let isDragging = false;
let lastMouse = [0, 0];
let audioCtx = null;
let currentSeedParams = { cx: 0, cy: 0 };

function init() {
    resize();
    window.addEventListener('resize', resize);
    updateTypeList();
    seedInput.value = state.seedValue;
    document.getElementById('panel').classList.add('open');
    setupInputHandlers();
}
function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    glCanvas.width = window.innerWidth * dpr;
    glCanvas.height = window.innerHeight * dpr;
    attrCanvas.width = window.innerWidth * dpr;
    attrCanvas.height = window.innerHeight * dpr;
    attrCanvas.style.width = window.innerWidth + 'px';
    attrCanvas.style.height = window.innerHeight + 'px';
}

function togglePanel() {
    document.getElementById('panel').classList.toggle('open');
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const btn = document.getElementById('btnSound');
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !state.soundEnabled);
}

function setMode(mode) {
    state.mode = mode;
    document.getElementById('modeClassic').classList.toggle('active', mode === 'classic');
    document.getElementById('modeChaos').classList.toggle('active', mode === 'chaos');
    updateTypeList();
}

function updateTypeList() {
    selectType.innerHTML = '';
    const list = state.mode === 'classic' ? FRACTALS_CLASSIC : FRACTALS_CHAOS;
    list.forEach((f, i) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        selectType.appendChild(opt);
    });
    state.type = list[0].id;
    selectType.value = state.type;
}

selectType.addEventListener('change', (e) => state.type = e.target.value);
document.getElementById('selectPalette').addEventListener('change', (e) => state.palette = parseInt(e.target.value));

function setInputMode(mode) {
    state.inputMode = mode;
    document.getElementById('inputDate').classList.toggle('active', mode === 'date');
    document.getElementById('inputNum').classList.toggle('active', mode === 'num');
    document.getElementById('inputText').classList.toggle('active', mode === 'text');    
    document.getElementById('btnNow').style.display = mode === 'date' ? 'flex' : 'none';
    document.getElementById('btnRandom').style.display = mode === 'num' ? 'flex' : 'none';
    
    if(mode === 'text') seedInput.placeholder = "Введите вопрос...";
    else seedInput.placeholder = "Введите сид...";
}

function setDateSeed() {
    seedInput.value = Date.now().toString();
    state.seedValue = seedInput.value;
}

function setRandomSeed() {
    const rand = Math.floor(Math.random() * 9000000000) + 1000000000;
    seedInput.value = rand.toString();
    state.seedValue = seedInput.value;
}

function updateSeedFromInput() {
    state.seedValue = seedInput.value;
}

function setupInputHandlers() {
    glCanvas.addEventListener('mousedown', (e) => {
        if (state.mode !== 'classic') return;
        isDragging = true;
        lastMouse = [e.clientX, e.clientY];
        glCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        glCanvas.style.cursor = 'move';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || state.mode !== 'classic') return;
        
        const dx = (e.clientX - lastMouse[0]);
        const dy = (e.clientY - lastMouse[1]);
        
        const scale = 4.0 / (viewZoom * glCanvas.height);
        viewCenter[0] -= dx * scale;
        viewCenter[1] += dy * scale;
        
        lastMouse = [e.clientX, e.clientY];
        
        if (gl && prog) {
            renderWebGL();        }
    });

    glCanvas.addEventListener('wheel', (e) => {
        if (state.mode !== 'classic') return;
        e.preventDefault();
        
        const zoomFactor = Math.exp(-e.deltaY * 0.001);
        const newZoom = viewZoom * zoomFactor;
        
        if (newZoom >= 0.5 && newZoom <= 1000000) {
            viewZoom = newZoom;
            if (gl && prog) {
                renderWebGL();
            }
        }
    }, { passive: false });

    let initialPinchDist = null;
    let initialZoom = 1;
    let lastTouchPos = null;

    glCanvas.addEventListener('touchstart', (e) => {
        if (state.mode !== 'classic') return;
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.sqrt(dx * dx + dy * dy);
            initialZoom = viewZoom;
        } else if (e.touches.length === 1) {
            lastTouchPos = [e.touches[0].clientX, e.touches[0].clientY];
        }
    }, { passive: true });

    glCanvas.addEventListener('touchmove', (e) => {
        if (state.mode !== 'classic') return;
        
        if (e.touches.length === 2 && initialPinchDist) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = dist / initialPinchDist;
            
            viewZoom = Math.max(0.5, Math.min(1000000, initialZoom * scale));
            if (gl && prog) renderWebGL();
        } else if (e.touches.length === 1 && lastTouchPos) {
            e.preventDefault();
            const dx = e.touches[0].clientX - lastTouchPos[0];
            const dy = e.touches[0].clientY - lastTouchPos[1];            
            const scale = 4.0 / (viewZoom * glCanvas.height);
            viewCenter[0] -= dx * scale;
            viewCenter[1] += dy * scale;
            
            lastTouchPos = [e.touches[0].clientX, e.touches[0].clientY];
            if (gl && prog) renderWebGL();
        }
    }, { passive: false });

    glCanvas.addEventListener('touchend', () => {
        lastTouchPos = null;
        initialPinchDist = null;
    });
}

function calculateSeedParams() {
    let seedNum = parseInt(state.seedValue.replace(/\D/g, '')) || 0;
    
    if (state.type === 'julia') {
        currentSeedParams.cx = ((seedNum % 10000) / 10000) * 4.0 - 2.0;
        currentSeedParams.cy = (((Math.floor(seedNum / 10000)) % 10000) / 10000) * 4.0 - 2.0;
    } else {
        currentSeedParams.cx = ((seedNum % 10000) / 10000) * 3.0 - 1.5;
        currentSeedParams.cy = (((Math.floor(seedNum / 10000)) % 10000) / 10000) * 3.0 - 1.5;
    }
}

function generate() {
    try {
        errorBox.style.display = 'none';
        
        if (state.soundEnabled) playSound(state.seedValue);

        calculateSeedParams();
        
        viewZoom = 1.0;
        
        const seedHash = state.seedValue.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        viewCenter = [
            ((Math.abs(seedHash) % 1000) / 1000) * 2.0 - 1.0,
            ((Math.abs(seedHash >> 16) % 1000) / 1000) * 2.0 - 1.0
        ];

        if (state.mode === 'classic') {
            glCanvas.style.display = 'block';            attrCanvas.style.display = 'none';
            initWebGL();
            renderWebGL();
        } else {
            glCanvas.style.display = 'none';
            attrCanvas.style.display = 'block';
            renderAttractor();
        }
        
        document.getElementById('panel').classList.remove('open');

    } catch (e) {
        showError(e.message);
    }
}

function showError(msg) {
    errorText.textContent = msg;
    errorBox.style.display = 'block';
    console.error(msg);
}

function initWebGL() {
    if (gl) return;

    gl = glCanvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw "WebGL2 не поддерживается";

    const vsObj = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsObj, vertexShaderSource);
    gl.compileShader(vsObj);
    
    const fsObj = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsObj, fragmentShaderSource);
    gl.compileShader(fsObj);

    if (!gl.getShaderParameter(fsObj, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(fsObj);
        gl.deleteShader(fsObj);
        throw "Ошибка компиляции шейдера:\n" + log;
    }

    prog = gl.createProgram();
    gl.attachShader(prog, vsObj);
    gl.attachShader(prog, fsObj);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    uniformLocs = {
        res: gl.getUniformLocation(prog, 'u_res'),
        zoom: gl.getUniformLocation(prog, 'u_zoom'),
        center: gl.getUniformLocation(prog, 'u_center'),
        cx: gl.getUniformLocation(prog, 'u_cx'),
        cy: gl.getUniformLocation(prog, 'u_cy'),
        type: gl.getUniformLocation(prog, 'u_type'),
        palette: gl.getUniformLocation(prog, 'u_palette')
    };
}

function renderWebGL() {
    if (!gl || !prog) {
        throw "WebGL не инициализирован";
    }

    gl.uniform2f(uniformLocs.res, glCanvas.width, glCanvas.height);
    gl.uniform1f(uniformLocs.zoom, viewZoom);
    gl.uniform2f(uniformLocs.center, viewCenter[0], viewCenter[1]);
    gl.uniform1f(uniformLocs.cx, currentSeedParams.cx);
    gl.uniform1f(uniformLocs.cy, currentSeedParams.cy);
    gl.uniform1i(uniformLocs.type, FRACTALS_CLASSIC.findIndex(f => f.id === state.type));
    gl.uniform1i(uniformLocs.palette, state.palette);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderAttractor() {
    const w = attrCanvas.width;
    const h = attrCanvas.height;
    ctxAttr.fillStyle = '#050505';
    ctxAttr.fillRect(0, 0, w, h);

    let seedNum = parseFloat(state.seedValue.replace(/\D/g, '')) || 123456789;
    
    let a = Math.sin(seedNum * 0.0001) * 2.5;
    let b = Math.cos(seedNum * 0.00013) * 2.5;
    let c = Math.sin(seedNum * 0.00017) * 2.5;
    let d = Math.cos(seedNum * 0.00019) * 2.5;

    let x = 0.1, y = 0.1;
    let iter = state.type === 'hopalong' ? 500000 : 2000000;
    
    ctxAttr.fillStyle = getAttractorColor();
    
    let skip = state.type === 'hopalong' ? 50 : 100;    for (let i = 0; i < skip; i++) {
        let nx, ny;
        if (state.type === 'clifford') {
            nx = Math.sin(a * y) + c * Math.cos(a * x);
            ny = Math.sin(b * x) + d * Math.cos(b * y);
        } else if (state.type === 'dejong') {
            nx = Math.sin(a * y) - Math.cos(b * x);
            ny = Math.sin(c * x) - Math.cos(d * y);
        } else if (state.type === 'hopalong') {
            let x_old = x;
            x = y - Math.sign(x_old) * Math.sqrt(Math.abs(b * x_old - c));
            y = a - x_old;
            continue;
        } else { // Pickover
            nx = Math.sin(b * y) + c * Math.sin(b * x);
            ny = Math.sin(a * x) + d * Math.sin(a * y);
        }
        x = nx; y = ny;
    }

    for (let i = 0; i < iter; i++) {
        let nx, ny;
        if (state.type === 'clifford') {
            nx = Math.sin(a * y) + c * Math.cos(a * x);
            ny = Math.sin(b * x) + d * Math.cos(b * y);
        } else if (state.type === 'dejong') {
            nx = Math.sin(a * y) - Math.cos(b * x);
            ny = Math.sin(c * x) - Math.cos(d * y);
        } else if (state.type === 'hopalong') {
            let x_old = x;
            x = y - Math.sign(x_old) * Math.sqrt(Math.abs(b * x_old - c));
            y = a - x_old;
            nx = x; ny = y;
        } else { // Pickover
            nx = Math.sin(b * y) + c * Math.sin(b * x);
            ny = Math.sin(a * x) + d * Math.sin(a * y);
        }
        
        if (state.type !== 'hopalong') {
            x = nx; y = ny;
        }

        let scale = state.type === 'hopalong' ? 0.08 : 0.15;
        let px = (x * scale + 0.5) * w;
        let py = (y * scale + 0.5) * h;

        if (px > 0 && px < w && py > 0 && py < h) {
            let size = state.type === 'hopalong' ? 2.0 : 1.5;
            ctxAttr.fillRect(px, py, size, size);
        }    }
}

function getAttractorColor() {
    const p = state.palette;
    if(p==0) return `rgba(255,255,255, 0.1)`;
    if(p==1) return `rgba(150,150,150, 0.1)`;
    if(p==2) return `rgba(255, 0, 255, 0.1)`;
    if(p==3) return `rgba(255, 100, 0, 0.1)`;
    if(p==4) return `rgba(100, 0, 255, 0.1)`;
    if(p==5) return `rgba(0, 255, 255, 0.1)`;
    if(p==6) return `rgba(0, 255, 100, 0.1)`;
    if(p==7) return `rgba(255, 150, 50, 0.1)`;
    if(p==8) return `rgba(255, 0, 0, 0.15)`;
    return `rgba(200, 200, 255, 0.1)`;
}

function playSound(seedStr) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        let num = parseInt(seedStr) || 0;
        let freq = 100 + (Math.abs(num) % 700);
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 2, audioCtx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.log("Sound error:", e);
    }
}

function savePNG() {
    let dataUrl;
    if (state.mode === 'classic') {
        dataUrl = glCanvas.toDataURL('image/png');    } else {
        dataUrl = attrCanvas.toDataURL('image/png');
    }
    
    const link = document.createElement('a');
    link.download = `oracle_seed_${state.seedValue}.png`;
    link.href = dataUrl;
    link.click();
}

init();