import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import * as TWEEN from '@tweenjs/tween.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

// --- Config ---
const CONFIG = {
    globeRadius: 15,
    colorBg: 0x000000,
    colorLine: 0xff00ff,
    cameraPos: { x: 0, y: 20, z: 50 }, // 最终要飞到的目标位置
    startPos: { x: 0, y: 200, z: 800 }, // 初始深空位置
    rootLat: 60
};

// --- Data ---
let projectData = {};
let aboutData = {};

async function loadData() {
    try {
        const [projectRes, aboutRes] = await Promise.all([
            fetch('./data.json'),
            fetch('./about.json')
        ]);
        projectData = await projectRes.json();
        aboutData = await aboutRes.json();
    } catch (e) {
        console.error("Data loading failed", e);
    }
}
loadData();

const hierarchy = {
    id: 'root', type: 'root', name: 'Ziqi Pan', unit: 'I care about people. I tell my fortune.',
    lat: CONFIG.rootLat, lon: 0,
    children: [
        {
            id: 'l1-1', label: 'About Me', type: 'level-1', lat: 20, lon: -60, children: []
        },
        {
            id: 'l1-2', label: 'Me as\nHCI Researcher', type: 'level-1', lat: 0, lon: 0,
            children: [
                { id: 'l2-1', label: 'Social Computing', type: 'level-2', lat: -10, lon: -25 },
                { id: 'l2-2', label: 'Social Interaction', type: 'level-2', lat: -20, lon: 0 },
                { id: 'l2-3', label: 'Self Interaction', type: 'level-2', lat: -10, lon: 25 }
            ]
        },
        {
            id: 'l1-3', label: 'Me as\nArtist', type: 'level-1', lat: 20, lon: 60,
            children: [
                { id: 'l2-4', label: 'Dance', type: 'level-2', lat: 10, lon: 80 },
                { id: 'l2-5', label: 'Music', type: 'level-2', lat: 30, lon: 80 },
                { id: 'l2-6', label: 'Photo', type: 'level-2', lat: 10, lon: 40 }
            ]
        }
    ]
};

// --- Scene Setup ---
const container = document.getElementById('scene-container');
const uiLayer = document.getElementById('ui-layer');
const overlayContainer = document.getElementById('overlay-container');
const overlayTitle = document.getElementById('overlay-title');
const overlayGrid = document.getElementById('overlay-grid');
const closeOverlayBtn = document.getElementById('close-overlay-btn');
const cosmicWhispers = document.getElementById('cosmic-whispers');

const scene = new THREE.Scene();

// --- Resource Management & Entrance Logic ---
// 1. 初始化 LoadingManager，用于监听所有贴图加载情况
const loadingManager = new THREE.LoadingManager();

loadingManager.onLoad = () => {
    console.log('✅ All resources loaded!');
    // 隐藏文字，显示按钮
    const loadingText = document.getElementById('loading-text');
    const enterBtn = document.getElementById('enter-btn');

    if (loadingText) loadingText.style.display = 'none';
    if (enterBtn) {
        enterBtn.style.display = 'block';
        setTimeout(() => { enterBtn.style.opacity = 1; }, 50);
    }
};

// 2. 将 manager 传给 loader
const textureLoader = new THREE.TextureLoader(loadingManager);

// --- Background ---
let bgMesh;
textureLoader.load('./bg-tarot20.JPG', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const bgGeometry = new THREE.SphereGeometry(800, 32, 32);
    const bgMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        color: 0x666666,
        fog: false
    });
    bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    scene.add(bgMesh);
});
scene.background = null;

// --- Camera & Renderer ---
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
// 初始位置设在深空
camera.position.set(CONFIG.startPos.x, CONFIG.startPos.y, CONFIG.startPos.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 20;
controls.maxDistance = 100;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.05;
// 初始禁用控制，防止用户在飞入前拖动
controls.enabled = false;

// --- Post Processing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 
    1.5, 0.4, 0.85
);
bloomPass.strength = 0.4;
bloomPass.radius = 0.3;
bloomPass.threshold = 0.1;
composer.addPass(bloomPass);

// --- Environment Map ---
function createProceduralEnvMap() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x000000);
    const stripGeo = new THREE.PlaneGeometry(100, 5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0, -20);
    strip.rotation.x = -Math.PI / 6;
    envScene.add(strip);
    const topGeo = new THREE.PlaneGeometry(100, 100);
    const topMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 50, 0);
    top.rotation.x = Math.PI / 2;
    envScene.add(top);
    const envMap = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();
    return envMap;
}
const customEnvMap = createProceduralEnvMap();
scene.environment = customEnvMap;

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);
const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
topLight.position.set(0, 50, 0);
scene.add(topLight);
const innerLight = new THREE.PointLight(0xaa00ff, 3, 50);
innerLight.position.set(0, 0, 0);
scene.add(innerLight);

const earthGroup = new THREE.Group();
scene.add(earthGroup);

// --- Particles (Sparkler) ---
const sparkCount = 800;
const sparkGeometry = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(sparkCount * 3);
const sparkColors = new Float32Array(sparkCount * 3);
const sparkSizes = new Float32Array(sparkCount);
const sparkData = [];

const colorCore = new THREE.Color(0xffffff);
const colorMid = new THREE.Color(0xffddaa);
const colorEdge = new THREE.Color(0xaa00ff);

for (let i = 0; i < sparkCount; i++) {
    sparkPositions[i * 3] = 0; sparkPositions[i * 3 + 1] = 0; sparkPositions[i * 3 + 2] = 0;
    sparkColors[i * 3] = 1; sparkColors[i * 3 + 1] = 1; sparkColors[i * 3 + 2] = 1;
    sparkSizes[i] = 1.5 + Math.random() * 1.5;
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    sparkData.push({
        velocity: dir.multiplyScalar(0.04 + Math.random() * 0.2),
        life: Math.random(),
        maxLife: 0.6 + Math.random() * 0.4,
        baseSize: sparkSizes[i]
    });
}
sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
sparkGeometry.setAttribute('size', new THREE.BufferAttribute(sparkSizes, 1));

function createSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    ctx.beginPath();
    ctx.moveTo(32, 10); ctx.lineTo(32, 54);
    ctx.moveTo(10, 32); ctx.lineTo(54, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}
const sparkMaterial = new THREE.PointsMaterial({
    vertexColors: true, size: 2.0, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, map: createSparkTexture()
});
const sparkSystem = new THREE.Points(sparkGeometry, sparkMaterial);
sparkSystem.renderOrder = 2;
earthGroup.add(sparkSystem);

// --- Core Material ---
const coreGeometry = new THREE.SphereGeometry(CONFIG.globeRadius * 0.98, 32, 32);
const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x38004f) },
        uColorMid: { value: new THREE.Color(0x6a0dad) },
        uColorLight: { value: new THREE.Color(0xcfaaf5) },
        uFresnelColor: { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
        varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewPosition;
        void main() {
            vUv = uv; vNormal = normalize(normalMatrix * normal); vPosition = position;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewPosition;
        uniform float uTime; uniform vec3 uColorDeep; uniform vec3 uColorMid; uniform vec3 uColorLight; uniform vec3 uFresnelColor;
        // Simplex Noise (Simplified for brevity)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(i.z+vec4(0,i1.z,i2.z,1))+i.y+vec4(0,i1.y,i2.y,1))+i.x+vec4(0,i1.x,i2.x,1));
            float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        float fbm(vec3 p) { float v=0.0; float a=0.5; for(int i=0;i<4;i++){v+=a*snoise(p);p*=2.0;a*=0.5;} return v; }
        void main() {
            vec3 viewDir = normalize(vViewPosition);
            float noiseVal = fbm(vPosition * 0.15 + uTime * 0.03); 
            float n = noiseVal * 0.5 + 0.5;
            vec3 baseColor = mix(uColorDeep, uColorMid, n);
            baseColor = mix(baseColor, uColorLight, smoothstep(0.6, 0.9, n));
            float fresnel = pow(1.0 - dot(viewDir, vNormal), 3.0);
            vec3 finalColor = baseColor + uFresnelColor * fresnel * 0.5;
            gl_FragColor = vec4(finalColor, 0.9); 
        }
    `,
});
const amethystCore = new THREE.Mesh(coreGeometry, coreMaterial);
earthGroup.add(amethystCore);

// --- Shell ---
const shellGeo = new THREE.SphereGeometry(CONFIG.globeRadius, 48, 48);
const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.0, roughness: 0.0, transmission: 1.0, transparent: true,
    opacity: 1.0, envMap: customEnvMap, envMapIntensity: 1.5, side: THREE.FrontSide,
    clearcoat: 1.0, clearcoatRoughness: 0.0
});
const shell = new THREE.Mesh(shellGeo, shellMat);
earthGroup.add(shell);

// --- Notes ---
const noteGroup = new THREE.Group();
scene.add(noteGroup);
function createNoteTexture(char) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 80px Arial'; ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
    ctx.fillText(char, 64, 64);
    return new THREE.CanvasTexture(canvas);
}
function initMusicalParticles() {
    const symbols = ['♩', '♪', '♫', '♬', '🎵', '🎶', '𝄞', '𝄢', '♭', ' ♯'];
    const mats = symbols.map(s => new THREE.SpriteMaterial({
        map: createNoteTexture(s), transparent: true, opacity: 0.9, color: 0xffffff,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    for (let i = 0; i < 100; i++) {
        const mat = mats[Math.floor(Math.random() * mats.length)].clone();
        const sprite = new THREE.Sprite(mat);
        const r = 40 + Math.random() * 80;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        sprite.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
        const scale = 2.0 + Math.random() * 3.0;
        sprite.scale.set(scale, scale, 1);
        sprite.userData = { yBase: sprite.position.y, phase: Math.random() * Math.PI * 2 };
        noteGroup.add(sprite);
    }
}
initMusicalParticles();

// --- Helpers ---
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 90) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
}
function createCurve(v1, v2) {
    const dist = v1.distanceTo(v2);
    const mid = v1.clone().add(v2).multiplyScalar(0.5).normalize().multiplyScalar(CONFIG.globeRadius + dist * 0.4);
    const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
    const points = curve.getPoints(100);
    const positions = []; const colors = [];
    const colorEnds = new THREE.Color(0x330066);
    const colorCenter = new THREE.Color(0xffffff);
    points.forEach((p, i) => {
        positions.push(p.x, p.y, p.z);
        const pct = i / points.length;
        const distFromCenter = Math.abs(pct - 0.5) * 2;
        const vertexColor = colorCenter.clone().lerp(colorEnds, Math.pow(distFromCenter, 1.5));
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    });
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);
    const material = new LineMaterial({
        linewidth: 4.5, vertexColors: true, resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new Line2(geometry, material);
    line.computeLineDistances(); line.renderOrder = 10;
    return line;
}

// --- Node Logic ---
const nodesMap = {};
let currentOpenNodeId = null;
let isInteractionActive = false;

function initNodes(data, parentPos = null) {
    const pos = latLonToVector3(data.lat, data.lon, CONFIG.globeRadius);
    const div = document.createElement('div');
    div.className = `node-label node-${data.type}`;
    div.id = `n-${data.id}`;

    if (data.type === 'root') {
        div.innerHTML = `<img src="profile_photo.jpg" class="avatar"><div class="info"><div class="name">${data.name}</div><div class="unit">${data.unit}</div></div>`;
        div.onclick = () => focusNode(data.id);
    } else if (data.type === 'level-1') {
        div.innerHTML = `<div class="dot-l1"></div><div class="text-l1">${data.label.replace(/\n/g, '<br>')}</div>`;
        div.onclick = (e) => { e.stopPropagation(); toggleLevel1(data.id); checkResumeRotation() };
    } else if (data.type === 'level-2') {
        div.innerHTML = `<div class="dot-l2"></div><div class="text-l2">${data.label}</div>`;
        div.onclick = (e) => { e.stopPropagation(); openOverlay(data.id); };
    }
    uiLayer.appendChild(div);
    const nodeObj = {
        id: data.id, data: data, posLocal: pos, element: div, visible: (data.type === 'root' || data.type === 'level-1'),
        expanded: false, childrenIds: data.children ? data.children.map(c => c.id) : [], lineMesh: null
    };
    if (parentPos) {
        const line = createCurve(parentPos, pos);
        earthGroup.add(line);
        nodeObj.lineMesh = line;
        if (data.type !== 'level-1') line.visible = false;
    }
    nodesMap[data.id] = nodeObj;
    if (data.children) data.children.forEach(c => initNodes(c, pos));
}

function checkResumeRotation() {
    let anyExpanded = false;
    for (const key in nodesMap) {
        if (nodesMap[key].expanded || currentOpenNodeId) 
            { anyExpanded = true; 
                break; }
    }
    const modal = document.getElementById('detail-modal');
    const isModalOpen = modal && modal.classList.contains('active');
    if (!anyExpanded && !isModalOpen) { 
        isInteractionActive = false; 
        controls.autoRotate = true; 
    }
}
function toggleLevel1(nodeId) {
    const node = nodesMap[nodeId];
    if (nodeId === 'l1-1') { showAboutMe(); return; }
    isInteractionActive = true; controls.autoRotate = false;
    if (!node.expanded) {
        for (const key in nodesMap) {
            const n = nodesMap[key];
            if (n.data.type === 'level-1' && n.expanded && n.id !== nodeId) toggleLevel1(n.id);
        }
    }
    node.expanded = !node.expanded;
    node.childrenIds.forEach(childId => {
        const child = nodesMap[childId];
        child.visible = node.expanded;
        if (child.lineMesh) child.lineMesh.visible = node.expanded;
        if (!node.expanded && child.expanded) { child.expanded = false; if (currentOpenNodeId === childId) closeOverlay(); }
    });
    focusNode(nodeId);
}
function openOverlay(nodeId) {
    currentOpenNodeId = nodeId;
    const node = nodesMap[nodeId];
    focusNode(nodeId, 1500, true);
    container.classList.add('blurred');
    uiLayer.classList.add('hidden');
    if (cosmicWhispers) cosmicWhispers.classList.add('blurred');
    overlayTitle.textContent = node.data.label;
    overlayGrid.innerHTML = '';
    const cards = projectData[nodeId] || [];
    if (cards.length > 0) {
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'overlay-card';
            cardEl.innerHTML = `<img src="${card.thumb}" class="tarot-thumb"><div class="tarot-title">${card.title}</div><div class="tarot-short-desc">${card.shortIntro}</div>`;
            cardEl.onclick = (e) => { e.stopPropagation(); showDetailView(card); };
            overlayGrid.appendChild(cardEl);
        });
    }
    overlayContainer.classList.add('active');
}
function closeOverlay() {
    currentOpenNodeId = null;
    overlayContainer.classList.remove('active');
    container.classList.remove('blurred');
    uiLayer.classList.remove('hidden');
    if (cosmicWhispers) cosmicWhispers.classList.remove('blurred');
    checkResumeRotation();
}
closeOverlayBtn.onclick = closeOverlay;

function showDetailView(card) {
    const modal = document.getElementById('detail-modal') || createDetailModal();
    modal.className = 'active';
    modal.classList.add(`layout-${card.layoutType}`);
    if (card.layoutType === 'academic') renderAcademicLayout(modal, card);
    else renderLeisureLayout(modal, card);
}
function renderAcademicLayout(modal, card) {
    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="this.parentElement.parentElement.classList.remove('active')">×</button>
            <header style="margin-bottom: 30px;"><h2 style="color:#c5a059; font-size: 2rem; margin-bottom: 10px;">${card.title}</h2><div style="width: 50px; height: 2px; background: #c5a059;"></div></header>
            <section style="margin-bottom: 40px;"><h4 style="color:#888; text-transform: uppercase; font-size:0.7rem; letter-spacing:2px;">Description</h4><p style="color:#ccc; line-height:1.8; font-size:0.95rem;">${card.details.fullDesc}</p></section>
            <section><h4 style="color:#888; text-transform: uppercase; font-size:0.7rem; letter-spacing:2px; margin-bottom:15px;">Outcomes</h4><div class="outcome-list">
                    ${card.details.outcomes.map(o => `<div class="outcome-item" onclick="window.open('${o.link}', '_blank')"><div class="outcome-header"><span class="outcome-icon" style="color: #ffffff">${o.icon}</span><span class="outcome-source">${o.source}</span><span class="outcome-status">${o.status}</span></div><div class="outcome-title">${o.title}</div><div class="outcome-authors">${o.authors}</div><div class="outcome-intro">${o.intro}</div><div style="text-align: right; color: #c5a059; font-size: 0.8rem;">View Project ↗</div></div>`).join('')}
                </div></section>
        </div>`;
    modal.classList.add('active');
}
function renderLeisureLayout(modal, card) {
    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="this.parentElement.parentElement.classList.remove('active')">×</button>
            <div class="leisure-hero" style="background-image: url(${card.thumb})"><div class="leisure-header"><h1>${card.title}</h1><span class="leisure-meta">${card.details.date} @ ${card.details.location}</span></div></div>
            <div class="leisure-body"><p class="leisure-story" style="font-size:0.9rem;">${card.details.story}</p><div class="leisure-gallery">${card.details.gallery ? card.details.gallery.map(img => `<img src="${img}" class="gallery-img">`).join('') : ''}</div></div>
        </div>`;
}
function createDetailModal() { 
    const m = document.createElement('div'); 
    m.id = 'detail-modal'; 
    document.body.appendChild(m); 
    return m; 
}
function showAboutMe() {
    const modal = document.getElementById('detail-modal') || createDetailModal();
    isInteractionActive = true; 
    controls.autoRotate = false;
    container.classList.add('blurred'); 
    uiLayer.classList.add('hidden');
    if (cosmicWhispers) cosmicWhispers.classList.add('blurred');
    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="closeAllModals()">×</button>
            <div class="about-modal-content">
                <div class="about-left"><img src="${aboutData.portrait}" class="about-portrait"><a href="${aboutData.cvLink}" class="cv-download-btn" download>Download CV</a></div>
                <div class="about-right"><h1 style="font-family:'Cinzel',serif; color:#c0c0c0; margin-bottom:5px;">${aboutData.name}</h1><p style="color:#888; font-size:0.9rem; margin-bottom:25px;">${aboutData.tagline}</p>
                <div class="about-recentupdate"><h3 style="font-family:'Cinzel',serif; color:#c0c0c0;">${aboutData.rctupd}</h3></div>
                <div class="about-bio">${aboutData.bio}</div>
                <div class="skills-tags">${aboutData.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
                <div class="about-socials">${aboutData.socials.map(s => `<a href="${s.url}" class="social-link" title="${s.platform}" target="_blank">${s.icon}</a>`).join('')}</div></div>
            </div>
        </div>`;
    modal.className = 'active layout-about';
    // window.closeAllModals 已经在下面定义
}
function closeAboutMe() {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('active');
    container.classList.remove('blurred');
    uiLayer.classList.remove('hidden');
    if (cosmicWhispers) cosmicWhispers.classList.remove('blurred');
    isInteractionActive = false; 
    checkResumeRotation();
}
window.closeAllModals = closeAboutMe;

function focusNode(nodeId, duration = 1000) {
    const node = nodesMap[nodeId];
    if (!node) return;
    const localPos = latLonToVector3(node.data.lat, node.data.lon, CONFIG.globeRadius);
    const worldPos = localPos.clone().applyMatrix4(earthGroup.matrixWorld);
    const currentDist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const targetPos = worldPos.normalize().multiplyScalar(currentDist);
    new TWEEN.Tween(camera.position).to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, duration).easing(TWEEN.Easing.Cubic.Out).onUpdate(() => controls.update()).start();
}

// --- Main Init ---
initNodes(hierarchy);

// ==========================================
// 5. Entrance Logic (入口交互逻辑 - 最终修复版)
// ==========================================
const btnElement = document.getElementById('enter-btn');
const loadingElement = document.getElementById('loading');

function enterUniverse() {
    console.log("🚀 Starting Fly-in Animation...");
    const targetPos = CONFIG.cameraPos;
    
    new TWEEN.Tween(camera.position)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 2500)
        .easing(TWEEN.Easing.Quintic.Out)
        .onUpdate(() => { controls.update(); })
        .onComplete(() => {
            console.log("✅ Arrived at destination");
            controls.enabled = true; 
            controls.autoRotate = true; 
        })
        .start();
}

if (btnElement) {
    btnElement.addEventListener('click', (e) => {
        e.stopPropagation(); 
        console.log("🖱️ Button Clicked!"); 
        
        // 1. 隐藏按钮
        btnElement.style.display = 'none'; 
        
        // 2. 开始飞入动画
        enterUniverse(); 
        
        // 3. 处理遮罩层 (关键修复)
        if (loadingElement) {
            // A. 先把这层“隐形玻璃”打洞，让鼠标能穿过去
            loadingElement.style.pointerEvents = 'none'; 
            
            // B. 开始视觉变透明
            loadingElement.style.opacity = '0'; 
            
            // C. 1.5秒后，用最强硬的方式移除它
            setTimeout(() => { 
                // 使用 setProperty ... 'important' 来覆盖 CSS 里的 !important
                loadingElement.style.setProperty('display', 'none', 'important');
            }, 1500); 
        }
    });
}

// --- Animation Loop ---
function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    controls.update();

    const positions = sparkSystem.geometry.attributes.position.array;
    const colors = sparkSystem.geometry.attributes.color.array;
    const sizes = sparkSystem.geometry.attributes.size.array;
    const limitRadiusSq = (CONFIG.globeRadius * 1.03) ** 2;

    for (let i = 0; i < sparkCount; i++) {
        const data = sparkData[i];
        const currentDistSq = positions[i * 3] * positions[i * 3] + positions[i * 3 + 1] * positions[i * 3 + 1] + positions[i * 3 + 2] * positions[i * 3 + 2];
        data.life += 0.01;
        if (data.life > data.maxLife || currentDistSq > limitRadiusSq) {
            data.life = 0;
            positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            data.velocity = dir.multiplyScalar(0.03 + Math.random() * 0.05);
        } else {
            positions[i * 3] += data.velocity.x; positions[i * 3 + 1] += data.velocity.y; positions[i * 3 + 2] += data.velocity.z;
            data.velocity.y -= 0.001;
        }
        const progress = data.life / data.maxLife;
        let color = new THREE.Color();
        if (progress < 0.2) color.copy(colorCore);
        else if (progress < 0.5) color.lerpColors(colorCore, colorMid, (progress - 0.2) / 0.3);
        else color.lerpColors(colorMid, colorEdge, (progress - 0.5) / 0.5);
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
        sizes[i] = data.baseSize * (1 - progress);
    }
    sparkSystem.geometry.attributes.position.needsUpdate = true;
    sparkSystem.geometry.attributes.color.needsUpdate = true;
    sparkSystem.geometry.attributes.size.needsUpdate = true;

    if (!isInteractionActive) { earthGroup.rotation.y += 0.0002; if (bgMesh) bgMesh.rotation.y += 0.0002; }
    noteGroup.rotation.y -= 0.0002;
    noteGroup.children.forEach(sprite => { sprite.position.y = sprite.userData.yBase + Math.sin(time * 0.001 + sprite.userData.phase) * 3; });

    for (const key in nodesMap) {
        const node = nodesMap[key];
        if (!node.visible) { node.element.style.transform = `translate(-10000px, -10000px)`; node.element.style.opacity = 0; continue; }
        const worldPos = node.posLocal.clone();
        worldPos.applyMatrix4(earthGroup.matrixWorld);
        const isBehind = worldPos.angleTo(camera.position) > Math.PI / 2.1;
        if (!isBehind) {
            worldPos.project(camera);
            const x = (worldPos.x * .5 + .5) * window.innerWidth;
            const y = (worldPos.y * -.5 + .5) * window.innerHeight;
            node.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            if (node.element.style.opacity === '0') node.element.style.opacity = 1;
        } else {
            node.element.style.opacity = 0; node.element.style.transform = `translate(-10000px, -10000px)`;
        }
    }
    composer.render();
}
window.addEventListener('resize', () => {
    const w = window.innerWidth; const h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); composer.setSize(w, h);
    for (const key in nodesMap) { if (nodesMap[key].lineMesh) nodesMap[key].lineMesh.material.resolution.set(w, h); }
});
controls.addEventListener('start', () => { controls.autoRotate = false; });
animate();