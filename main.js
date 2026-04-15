// --- ДАННЫЕ МЕНЮ (ИЕРАРХИЯ) ---
const MENU_DATA = {
    escape: {
        label: "Escape-Time",
        types: {
            classic: {
                label: "Классика",
                fractals: { 
                    mandelbrot: "Mandelbrot", 
                    burning: "Burning Ship", 
                    tricorn: "Tricorn", 
                    celtic: "Celtic" 
                }
            },
            seed_dependent: {
                label: "Seed-Z (Julia/Multi)",
                fractals: { 
                    julia: "Julia Set", 
                    multibrot: "Multibrot (n=3)" 
                }
            }
            // Сюда позже добавим Organic и Root
        }
    },
    chaos: {
        label: "Chaos",
        types: {
            attractors: {
                label: "Аттракторы",
                fractals: { 
                    clifford: "Clifford", 
                    dejong: "De Jong", 
                    hopalong: "Hopalong", 
                    pickover: "Pickover" 
                }
            }
            // Сюда позже добавим IFS
        }
    },
    geometric: {
        label: "Geometric",
        types: {
            l_system: {
                label: "L-Systems",
                fractals: { 
                    l_sys: "Растения (L-System)" 
                }
            }
        }
    }};

// Состояние приложения
let state = {
    system: 'escape',
    type: 'classic',
    fractal: 'mandelbrot',
    palette: 0,
    inputMode: 'date',
    seedValue: Date.now().toString(),
    soundEnabled: false
};

// Переменные рендера
const glCanvas = document.getElementById('glCanvas');
const attrCanvas = document.getElementById('attractorCanvas');
const ctxAttr = attrCanvas.getContext('2d');
const selectPalette = document.getElementById('selectPalette');
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
let randomPaletteOption = null; // Для хранения временной палитры

// --- ИНИЦИАЛИЗАЦИЯ ---
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // Рендерим начальное меню
    renderSystemRow();
    renderTypeRow();
    renderFractalRow();
    
    seedInput.value = state.seedValue;
    document.getElementById('panel').classList.add('open');
    setupInputHandlers();
}

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);    glCanvas.width = window.innerWidth * dpr;
    glCanvas.height = window.innerHeight * dpr;
    attrCanvas.width = window.innerWidth * dpr;
    attrCanvas.height = window.innerHeight * dpr;
    attrCanvas.style.width = window.innerWidth + 'px';
    attrCanvas.style.height = window.innerHeight + 'px';
}

function togglePanel() {
    document.getElementById('panel').classList.toggle('open');
}

// --- ЛОГИКА МЕНЮ ---

// 1. Отрисовка ряда Систем
function renderSystemRow() {
    const container = document.getElementById('scroll-system');
    container.innerHTML = '';
    Object.keys(MENU_DATA).forEach(key => {
        const item = document.createElement('div');
        item.className = `nav-item ${state.system === key ? 'active' : ''}`;
        item.textContent = MENU_DATA[key].label;
        item.onclick = () => selectSystem(key);
        container.appendChild(item);
    });
}

// 2. Отрисовка ряда Типов (зависит от Системы)
function renderTypeRow() {
    const container = document.getElementById('scroll-type');
    container.innerHTML = '';
    const types = MENU_DATA[state.system].types;
    Object.keys(types).forEach(key => {
        const item = document.createElement('div');
        item.className = `nav-item ${state.type === key ? 'active' : ''}`;
        item.textContent = types[key].label;
        item.onclick = () => selectType(key);
        container.appendChild(item);
    });
}

// 3. Отрисовка ряда Фракталов (зависит от Типа)
function renderFractalRow() {
    const container = document.getElementById('scroll-fractal');
    container.innerHTML = '';
    const fractals = MENU_DATA[state.system].types[state.type].fractals;
    Object.keys(fractals).forEach(key => {
        const item = document.createElement('div');
        item.className = `nav-item ${state.fractal === key ? 'active' : ''}`;
        item.textContent = fractals[key];        item.onclick = () => selectFractal(key);
        container.appendChild(item);
    });
}

// Действия выбора
function selectSystem(key) {
    state.system = key;
    // Сброс типа на первый доступный
    state.type = Object.keys(MENU_DATA[key].types)[0];
    // Сброс фрактала на первый доступный
    state.fractal = Object.keys(MENU_DATA[key].types[state.type].fractals)[0];
    
    renderSystemRow();
    renderTypeRow();
    renderFractalRow();
}

function selectType(key) {
    state.type = key;
    // Сброс фрактала на первый доступный
    state.fractal = Object.keys(MENU_DATA[state.system].types[key].fractals)[0];
    
    renderTypeRow();
    renderFractalRow();
}

function selectFractal(key) {
    state.fractal = key;
    renderFractalRow();
}

// Прокрутка стрелками
function scrollRow(type, direction) {
    const container = document.getElementById(`scroll-${type}`);
    const scrollAmount = 100;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// --- РАНДОМНАЯ ПАЛИТРА ---
function generateRandomPalette() {
    // Если есть старая временная палитра, удаляем её
    if (randomPaletteOption) {
        selectPalette.removeChild(randomPaletteOption);
    }

    // Генерируем имя
    const chars = "0123456789ABCDEF!@#%&";
    let name = "❔";
    for(let i=0; i<6; i++) name += chars[Math.floor(Math.random() * chars.length)];
    // Создаем Option
    randomPaletteOption = document.createElement('option');
    randomPaletteOption.value = "random"; // Специальное значение
    randomPaletteOption.textContent = name;
    randomPaletteOption.selected = true;
    
    selectPalette.appendChild(randomPaletteOption);
    state.palette = "random";
}

// --- ОБРАБОТЧИКИ ИНПУТОВ ---
function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const btn = document.getElementById('btnSound');
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !state.soundEnabled);
}

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
        if (state.system !== 'escape') return;        isDragging = true;
        lastMouse = [e.clientX, e.clientY];
        glCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        glCanvas.style.cursor = 'move';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || state.system !== 'escape') return;
        const dx = (e.clientX - lastMouse[0]);
        const dy = (e.clientY - lastMouse[1]);
        const scale = 4.0 / (viewZoom * glCanvas.height);
        viewCenter[0] -= dx * scale;
        viewCenter[1] += dy * scale;
        lastMouse = [e.clientX, e.clientY];
        if (gl && prog) renderWebGL();
    });

    glCanvas.addEventListener('wheel', (e) => {
        if (state.system !== 'escape') return;
        e.preventDefault();
        const zoomFactor = Math.exp(-e.deltaY * 0.001);
        const newZoom = viewZoom * zoomFactor;
        if (newZoom >= 0.5 && newZoom <= 1000000) {
            viewZoom = newZoom;
            if (gl && prog) renderWebGL();
        }
    }, { passive: false });

    // Touch support
    let initialPinchDist = null, initialZoom = 1, lastTouchPos = null;

    glCanvas.addEventListener('touchstart', (e) => {
        if (state.system !== 'escape') return;
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
        if (state.system !== 'escape') return;
        if (e.touches.length === 2 && initialPinchDist) {            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            viewZoom = Math.max(0.5, Math.min(1000000, initialZoom * (dist / initialPinchDist)));
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

    glCanvas.addEventListener('touchend', () => { lastTouchPos = null; initialPinchDist = null; });
}

function calculateSeedParams() {
    let seedNum = parseInt(state.seedValue.replace(/\D/g, '')) || 0;
    if (state.fractal === 'julia') {
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

        // Логика отображения        if (state.system === 'escape') {
            glCanvas.style.display = 'block';
            attrCanvas.style.display = 'none';
            initWebGL();
            renderWebGL();
        } else if (state.system === 'chaos') {
            glCanvas.style.display = 'none';
            attrCanvas.style.display = 'block';
            renderAttractor();
        } else {
            // Geometric пока заглушка
            alert("Геометрические фракталы (L-Systems) скоро будут доступны!");
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
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
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
    if (!gl || !prog) throw "WebGL не инициализирован";

    gl.uniform2f(uniformLocs.res, glCanvas.width, glCanvas.height);
    gl.uniform1f(uniformLocs.zoom, viewZoom);
    gl.uniform2f(uniformLocs.center, viewCenter[0], viewCenter[1]);
    gl.uniform1f(uniformLocs.cx, currentSeedParams.cx);
    gl.uniform1f(uniformLocs.cy, currentSeedParams.cy);

    // Маппинг фракталов на индексы шейдера
    let typeIndex = 0;
    if (state.fractal === 'julia') typeIndex = 1;
    else if (state.fractal === 'burning') typeIndex = 2;
    else if (state.fractal === 'multibrot') typeIndex = 3;
    else if (state.fractal === 'tricorn') typeIndex = 4;
    else if (state.fractal === 'celtic') typeIndex = 5;

    gl.uniform1i(uniformLocs.type, typeIndex);

    // Обработка палитры
    let palIndex = state.palette;
    if (state.palette === "random") {
        // Для рандомной палитры используем временный индекс 9
        palIndex = 9;
    }
    gl.uniform1i(uniformLocs.palette, palIndex);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderAttractor() {
    const w = attrCanvas.width;    const h = attrCanvas.height;
    ctxAttr.fillStyle = '#050505';
    ctxAttr.fillRect(0, 0, w, h);

    let seedNum = parseFloat(state.seedValue.replace(/\D/g, '')) || 123456789;
    
    let a = Math.sin(seedNum * 0.0001) * 2.5;
    let b = Math.cos(seedNum * 0.00013) * 2.5;
    let c = Math.sin(seedNum * 0.00017) * 2.5;
    let d = Math.cos(seedNum * 0.00019) * 2.5;

    let x = 0.1, y = 0.1;
    let iter = state.fractal === 'hopalong' ? 500000 : 2000000;
    
    ctxAttr.fillStyle = getAttractorColor();
    
    let skip = state.fractal === 'hopalong' ? 50 : 100;
    for (let i = 0; i < skip; i++) {
        let nx, ny;
        if (state.fractal === 'clifford') {
            nx = Math.sin(a * y) + c * Math.cos(a * x);
            ny = Math.sin(b * x) + d * Math.cos(b * y);
        } else if (state.fractal === 'dejong') {
            nx = Math.sin(a * y) - Math.cos(b * x);
            ny = Math.sin(c * x) - Math.cos(d * y);
        } else if (state.fractal === 'hopalong') {
            let x_old = x;
            x = y - Math.sign(x_old) * Math.sqrt(Math.abs(b * x_old - c));
            y = a - x_old;
            continue;
        } else {
            nx = Math.sin(b * y) + c * Math.sin(b * x);
            ny = Math.sin(a * x) + d * Math.sin(a * y);
        }
        x = nx; y = ny;
    }

    for (let i = 0; i < iter; i++) {
        let nx, ny;
        if (state.fractal === 'clifford') {
            nx = Math.sin(a * y) + c * Math.cos(a * x);
            ny = Math.sin(b * x) + d * Math.cos(b * y);
        } else if (state.fractal === 'dejong') {
            nx = Math.sin(a * y) - Math.cos(b * x);
            ny = Math.sin(c * x) - Math.cos(d * y);
        } else if (state.fractal === 'hopalong') {
            let x_old = x;
            x = y - Math.sign(x_old) * Math.sqrt(Math.abs(b * x_old - c));
            y = a - x_old;
            nx = x; ny = y;        } else {
            nx = Math.sin(b * y) + c * Math.sin(b * x);
            ny = Math.sin(a * x) + d * Math.sin(a * y);
        }
        
        if (state.fractal !== 'hopalong') {
            x = nx; y = ny;
        }

        let scale = state.fractal === 'hopalong' ? 0.08 : 0.15;
        let px = (x * scale + 0.5) * w;
        let py = (y * scale + 0.5) * h;

        if (px > 0 && px < w && py > 0 && py < h) {
            let size = state.fractal === 'hopalong' ? 2.0 : 1.5;
            ctxAttr.fillRect(px, py, size, size);
        }
    }
}

function getAttractorColor() {
    const p = state.palette;
    if(p=="random" || p==2) return `rgba(255, 0, 255, 0.1)`; // Для рандома берем яркий цвет
    if(p==0) return `rgba(255,255,255, 0.1)`;
    if(p==1) return `rgba(150,150,150, 0.1)`;
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
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
        osc.stop(audioCtx.currentTime + 0.5);    } catch (e) { console.log("Sound error:", e); }
}

function savePNG() {
    let dataUrl;
    if (state.system === 'escape') dataUrl = glCanvas.toDataURL('image/png');
    else dataUrl = attrCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `oracle_seed_${state.seedValue}.png`;
    link.href = dataUrl;
    link.click();
}

init();