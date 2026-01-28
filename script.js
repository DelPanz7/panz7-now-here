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
    cameraPos: { x: 0, y: 20, z: 50 }, 
    rootLat: 60
};

// --- Data ---
// 在 script.js 顶部声明一个全局变量存储数据
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
            id: 'l1-1', label: 'Me', type: 'level-1', lat: 20, lon: -60, children: []
        },
        {
            id: 'l1-2', label: 'Me as\nHCI Researcher', type: 'level-1', lat: 0, lon: 0,
            children: [
                {
                    id: 'l2-1', label: 'Human-Environment', type: 'level-2', lat: -10, lon: -25,
                },
                {
                    id: 'l2-2', label: 'Human-Human', type: 'level-2', lat: -20, lon: 0,
                },
                {
                    id: 'l2-3', label: 'Human-Self', type: 'level-2', lat: -10, lon: 25,
                }
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

const scene = new THREE.Scene();
//scene.background = new THREE.Color(0x000000);
//scene.fog = new THREE.FogExp2(0x000000, 0.02);
// --- 1. 创建平面背景图逻辑 ---
/**
const textureLoader = new THREE.TextureLoader();
let bgMesh;

textureLoader.load('./bg-tarot.png', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // 创建平面几何体
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        // 【关键】通过 color 来控制“暗色蒙版”效果
        // 0x444444 约 25% 亮度，0x888888 约 50% 亮度，0xffffff 是图片原色
        color: 0x666666 
    });
    
    bgMesh = new THREE.Mesh(geometry, material);
    
    // 渲染顺序设为最底层
    bgMesh.renderOrder = -1;
    
    // 把背景挂在相机上，这样背景就会随相机一起移动，永远正对屏幕
    camera.add(bgMesh);
    scene.add(camera);
    
    // 初始调整一次背景尺寸
    updateBgSize();
});*/

// --- 1. 加载背景图并创建 3D 背景层 ---
const textureLoader = new THREE.TextureLoader();
let bgMesh;
// 替换为你图片的真实路径
textureLoader.load('./bg-tarot20.JPG', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // 创建一个巨大的球体，把背景贴在里面
    const bgGeometry = new THREE.SphereGeometry(800, 60, 40);
    const bgMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide, // 贴在内侧
        // 【关键】通过 color 属性来实现“黑色半透明蒙版”的效果
        // 0x333333 相当于 20% 亮度，0x666666 相当于 40% 亮度
        // 数字越小，背景越暗，紫色连线发光就越明显
        color: 0x666666, 
        fog: false // 背景不受雾气影响，防止变纯黑
    });
    
    bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    scene.add(bgMesh);
});

// 确保 scene 自身没有背景色，防止冲突
scene.background = null;

// 计算背景平面尺寸，使其完美填充屏幕
function updateBgSize() {
    if (!bgMesh) return;
    
    // 将背景放在相机前方足够远的地方（但要在远剪裁平面内）
    const dist = 100; 
    bgMesh.position.set(0, 0, -dist);
    
    // 根据相机 FOV 和距离计算平面应该有多大才能填满窗口
    const fovInRadians = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fovInRadians / 2) * dist;
    const width = height * camera.aspect;
    
    bgMesh.scale.set(width, height, 1);
}

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(CONFIG.cameraPos.x, CONFIG.cameraPos.y, CONFIG.cameraPos.z);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
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
controls.autoRotateSpeed = 0.2;

// --- Interaction State ---
// 这个变量控制球体是否自转。只要有节点打开，它就是 true。
let isInteractionActive = false; 

// --- Post Processing (Bloom) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.strength = 0.4;  
bloomPass.radius = 0.3;
bloomPass.threshold = 0.1; 
composer.addPass(bloomPass);

// --- Environment Map Generator (The "Sunset Reflection" Magic) ---
// 我们创建一个虚拟场景，渲染出一张 HDR 贴图作为水晶球的环境反射
// 这样可以制造出完美的“黑白地平线”倒影，而不需要外部 jpg
function createProceduralEnvMap() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x000000);

    // 1. 地平线光带 (Horizon Strip) - 模拟海平面夕阳
    const stripGeo = new THREE.PlaneGeometry(100, 5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 纯白强光
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0, -20); // 放在前方
    strip.rotation.x = -Math.PI / 6; // 稍微倾斜
    envScene.add(strip);

    // 2. 顶部柔光 (Top Light)
    const topGeo = new THREE.PlaneGeometry(100, 100);
    const topMat = new THREE.MeshBasicMaterial({ color: 0x222222 }); // 弱光
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 50, 0);
    top.rotation.x = Math.PI / 2;
    envScene.add(top);

    const envMap = pmremGenerator.fromScene(envScene).texture;
    pmremGenerator.dispose();
    
    return envMap;
}

const customEnvMap = createProceduralEnvMap();
scene.environment = customEnvMap; // 全局应用反射

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

// 顶部强光
const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
topLight.position.set(0, 50, 0);
scene.add(topLight);

// 内部点光源 (紫色)
const innerLight = new THREE.PointLight(0xaa00ff, 3, 50);
innerLight.position.set(0, 0, 0);
scene.add(innerLight);

// --- The Crystal Object Group ---
const earthGroup = new THREE.Group(); 
scene.add(earthGroup);

// =========================================================
// 2. Sparkler Core (Particles) - 仙女棒喷射层
// =========================================================
const sparkCount = 800;
const sparkGeometry = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(sparkCount * 3);
const sparkColors = new Float32Array(sparkCount * 3);
const sparkSizes = new Float32Array(sparkCount);
const sparkData = [];

const colorCore = new THREE.Color(0xffffff); // 白
const colorMid = new THREE.Color(0xffddaa); // 金
const colorEdge = new THREE.Color(0xaa00ff); // 紫

for(let i = 0; i < sparkCount; i++) {
    sparkPositions[i*3] = 0;
    sparkPositions[i*3+1] = 0;
    sparkPositions[i*3+2] = 0;
    
    sparkColors[i*3] = 1; sparkColors[i*3+1] = 1; sparkColors[i*3+2] = 1;
    
    sparkSizes[i] = 1.5 + Math.random() * 1.5; 

    const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
    sparkData.push({
        velocity: dir.multiplyScalar(0.04 + Math.random() * 0.2), // 速度
        life: Math.random(),
        maxLife: 0.6 + Math.random() * 0.4,
        baseSize: sparkSizes[i]
    });
}

sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
sparkGeometry.setAttribute('size', new THREE.BufferAttribute(sparkSizes, 1));

// 【修改】新的贴图生成：十字星光，看起来像火花
function createSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 核心光晕
    const grad = ctx.createRadialGradient(32,32,0, 32,32,32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,64,64);

    // 十字芒星
    ctx.beginPath();
    ctx.moveTo(32, 10); ctx.lineTo(32, 54);
    ctx.moveTo(10, 32); ctx.lineTo(54, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
}

const sparkMaterial = new THREE.PointsMaterial({
    vertexColors: true,
    size: 2.0, // 全局大小倍率
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: createSparkTexture() 
});

const sparkSystem = new THREE.Points(sparkGeometry, sparkMaterial);
sparkSystem.renderOrder = 2; 
earthGroup.add(sparkSystem);


// ==========================================
// 1. Amethyst Core (Shader Material)
// 这是一个实心球，但用 Shader 模拟内部云雾
// ==========================================
const coreGeometry = new THREE.SphereGeometry(CONFIG.globeRadius * 0.98, 64, 64);

const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        // 紫水晶的颜色梯度
        uColorDeep: { value: new THREE.Color(0x38004f) },  // 深紫
        uColorMid: { value: new THREE.Color(0x6a0dad) },   // 纯紫
        uColorLight: { value: new THREE.Color(0xcfaaf5) }, // 浅薰衣草色
        uFresnelColor: { value: new THREE.Color(0xffffff) } // 边缘光
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;
        
        uniform float uTime;
        uniform vec3 uColorDeep;
        uniform vec3 uColorMid;
        uniform vec3 uColorLight;
        uniform vec3 uFresnelColor;

        // 3D Noise Function (Simplex)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute( permute( permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        // Fractal Brownian Motion (叠加多层噪声，制造细节)
        float fbm(vec3 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 4; i++) {
                value += amplitude * snoise(p);
                p *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            // 计算视线向量
            vec3 viewDir = normalize(vViewPosition);
            
            // 1. 生成内部云雾纹理
            // 这里的 uTime * 0.05 决定了内部移动的速度 (很慢)
            float noiseVal = fbm(vPosition * 0.15 + uTime * 0.03); 
            
            // 将噪声值映射到颜色 (深紫 -> 浅紫)
            // noiseVal 通常在 -1 到 1 之间
            float n = noiseVal * 0.5 + 0.5; // 归一化到 0-1
            
            // 颜色混合逻辑
            vec3 baseColor = mix(uColorDeep, uColorMid, n);
            baseColor = mix(baseColor, uColorLight, smoothstep(0.6, 0.9, n)); // 高亮部分

            // 2. 菲涅尔效应 (Fresnel Effect) - 边缘亮，中心透
            // 模拟水晶球边缘的反光
            float fresnel = pow(1.0 - dot(viewDir, vNormal), 3.0);
            
            // 3. 模拟深度感 (假装中心更深)
            float depth = 1.0; 
            
            // 最终混合
            vec3 finalColor = baseColor + uFresnelColor * fresnel * 0.5;
            
            // 让颜色稍微暗一点，模拟内部的深邃
            gl_FragColor = vec4(finalColor, 0.9); 
        }
    `,
});

const amethystCore = new THREE.Mesh(coreGeometry, coreMaterial);
earthGroup.add(amethystCore);


// ==========================================
// 2. Outer Glass Shell (Reflections)
// 这是罩在最外面的一层，用来显示“海边倒影”
// ==========================================
const shellGeo = new THREE.SphereGeometry(CONFIG.globeRadius, 64, 64);
const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,        // 纯白基底，为了最好地显示反射
    metalness: 0.0,         
    roughness: 0.0,         // 绝对光滑
    
    transmission: 1.0,      // 半透明，透出里面的 Shader
    transparent: true,
    opacity: 1.0,           
    
    envMap: customEnvMap,
    envMapIntensity: 1.5,   // 增强倒影强度
    
    side: THREE.FrontSide,
    clearcoat: 1.0,         // 清漆层
    clearcoatRoughness: 0.0
});

const shell = new THREE.Mesh(shellGeo, shellMat);
earthGroup.add(shell);

// =========================================================
// 4. Background Notes (Visible Now!) - 音符粒子
// =========================================================
const noteGroup = new THREE.Group();
scene.add(noteGroup);

function createNoteTexture(char) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128; // 放大画布
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 80px Arial'; // 放大字体
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.fillText(char, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function initMusicalParticles() {
    const symbols = ['♩', '♪', '♫', '♬', '🎵', '🎶', '𝄞', '𝄢', '♭', ' ♯'];
    const mats = symbols.map(s => new THREE.SpriteMaterial({
        map: createNoteTexture(s),
        transparent: true,
        opacity: 0.9, // 提高不透明度
        color: 0xffffff, // 纯白最亮
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    }));

    const count = 100; // 数量适中
    for (let i=0; i<count; i++) {
        const mat = mats[Math.floor(Math.random() * mats.length)].clone();
        const sprite = new THREE.Sprite(mat);
        
        // 【关键修改】拉近距离范围
        // 相机在 z=50，我们将粒子放在 40~120 范围内，这样有些在眼前，有些在背景
        const r = 40 + Math.random() * 80; 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        sprite.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        
        // 【关键修改】再次加大尺寸
        const scale = 2.0 + Math.random() * 3.0; 
        sprite.scale.set(scale, scale, 1);
        
        sprite.userData = { 
            yBase: sprite.position.y,
            phase: Math.random() * Math.PI * 2 
        };
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
    const points = curve.getPoints(100); // 增加采样点，让渐变更丝滑

    const positions = [];
    const colors = [];
    
    // 定义渐变颜色
    const colorEnds = new THREE.Color(0x330066); // 线条两端：极深的紫色
    const colorCenter = new THREE.Color(0xffffff); // 线条中心：纯白色（辉光核心）

    points.forEach((p, i) => {
        positions.push(p.x, p.y, p.z);
        
        // 计算颜色渐变百分比：i=0 或 i=100 时接近 colorEnds，i=50 时接近 colorCenter
        const pct = i / points.length;
        const distFromCenter = Math.abs(pct - 0.5) * 2; // 0 (中心) 到 1 (两端)
        
        const vertexColor = colorCenter.clone().lerp(colorEnds, Math.pow(distFromCenter, 1.5));
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    });

    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors); // 注入顶点颜色

    const material = new LineMaterial({
        linewidth: 4.5, // 足够粗，配合渐变就不显死板了
        vertexColors: true, // 开启顶点着色
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending, // 核心！叠加模式制造“星轨”的透明发光感
        depthWrite: false
    });

    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.renderOrder = 10;
    
    return line;
}

// --- Node Logic ---
const nodesMap = {}; 
let currentOpenNodeId = null;

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
        div.onclick = (e) => { e.stopPropagation(); toggleLevel1(data.id); checkResumeRotation()};
    } else if (data.type === 'level-2') {
        div.innerHTML = `<div class="dot-l2"></div><div class="text-l2">${data.label}</div>`;
        div.onclick = (e) => { e.stopPropagation(); openOverlay(data.id); };
    } 
    
    uiLayer.appendChild(div);

    const nodeObj = {
        id: data.id,
        data: data,
        posLocal: pos,
        element: div,
        visible: (data.type === 'root' || data.type === 'level-1'),
        expanded: false,
        childrenIds: data.children ? data.children.map(c => c.id) : [],
        lineMesh: null
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

// --- Interaction Logic ---

// 检查是否所有子节点都关闭了，如果是，恢复自转
function checkResumeRotation() {
    let anyExpanded = false;
    for (const key in nodesMap) {
        if (nodesMap[key].expanded || currentOpenNodeId) {
            anyExpanded = true;
            break;
        }
    }
    
    if (!anyExpanded) {
        isInteractionActive = false;
        controls.autoRotate = true; // 恢复 OrbitControls 的自转
    }
}

function toggleLevel1(nodeId) {
    const node = nodesMap[nodeId];
    if (nodeId === 'l1-1') {
        showAboutMe();
        return; // 直接返回，不执行展开子节点的逻辑
    }

    // 标记交互开始，停止自转
    isInteractionActive = true;
    controls.autoRotate = false;

    if (!node.expanded) {
        for (const key in nodesMap) {
            const n = nodesMap[key];
            if (n.data.type === 'level-1' && n.expanded && n.id !== nodeId) {
                toggleLevel1(n.id); 
            }
        }
    }
    node.expanded = !node.expanded;
    node.childrenIds.forEach(childId => {
        const child = nodesMap[childId];
        child.visible = node.expanded;
        if (child.lineMesh) child.lineMesh.visible = node.expanded;
        if (!node.expanded && child.expanded) {
            child.expanded = false; 
            if (currentOpenNodeId === childId) closeOverlay();
        }
    });
    
    focusNode(nodeId);

    // 如果关闭了，检查是否可以恢复自转
    //if (!node.expanded) {
        //checkResumeRotation();
    //}
}

function openOverlay(nodeId) {
    currentOpenNodeId = nodeId;
    const node = nodesMap[nodeId];
    
    focusNode(nodeId, 1500, true);
    container.classList.add('blurred');
    uiLayer.classList.add('hidden');

    overlayTitle.textContent = node.data.label;
    overlayGrid.innerHTML = '';

    // 从全局 projectData 中根据 L2 的 ID 获取卡片列表
    const cards = projectData[nodeId] || [];

    if (cards.length > 0) {
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'overlay-card';
            cardEl.innerHTML = `
                <img src="${card.thumb}" class="tarot-thumb">
                <div class="tarot-title">${card.title}</div>
                <div class="tarot-short-desc">${card.shortIntro}</div>
            `;
            // 点击塔罗牌展示详情
            cardEl.onclick = (e) => {
                e.stopPropagation();
                showDetailView(card);
            };
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
    
    checkResumeRotation();
}

closeOverlayBtn.onclick = closeOverlay;

function showDetailView(card) {
    const modal = document.getElementById('detail-modal') || createDetailModal();
    
    modal.className = 'active'; 
    modal.classList.add(`layout-${card.layoutType}`);

    if (card.layoutType === 'academic') {
        renderAcademicLayout(modal, card);
    } else {
        renderLeisureLayout(modal, card);
    }
}

function renderAcademicLayout(modal, card) {
    // 渲染详情
    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="this.parentElement.parentElement.classList.remove('active')">×</button>
            
            <header style="margin-bottom: 30px;">
                <h2 style="color:#c5a059; font-size: 2rem; margin-bottom: 10px;">${card.title}</h2>
                <div style="width: 50px; height: 2px; background: #c5a059;"></div>
            </header>

            <section style="margin-bottom: 40px;">
                <h4 style="color:#888; text-transform: uppercase; font-size:0.7rem; letter-spacing:2px;">Description</h4>
                <p style="color:#ccc; line-height:1.8; font-size:0.95rem;">${card.details.fullDesc}</p>
            </section>

            <section>
                <h4 style="color:#888; text-transform: uppercase; font-size:0.7rem; letter-spacing:2px; margin-bottom:15px;">Outcomes</h4>
                <div class="outcome-list">
                    ${card.details.outcomes.map(o => `
                        <div class="outcome-item" onclick="window.open('${o.link}', '_blank')">
                            <div class="outcome-header">
                                <span class="outcome-icon">${o.icon}</span>
                                <span class="outcome-source">${o.source}</span>
                                <span class="outcome-status">${o.status}</span>
                            </div>
                            <div class="outcome-title">${o.title}</div>
                            <div class="outcome-authors">${o.authors}</div>
                            <div class="outcome-intro">${o.intro}</div>
                            <div style="text-align: right; color: #c5a059; font-size: 0.8rem;">View Project ↗</div>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;
    
    modal.classList.add('active');
}

function renderLeisureLayout(modal, card) {
    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="this.parentElement.parentElement.classList.remove('active')">×</button>
            
            <div class="leisure-hero" style="background-image: url(${card.thumb})">
                <div class="leisure-header">
                    <h1>${card.title}</h1>
                    <span class="leisure-meta">${card.details.date} @ ${card.details.location}</span>
                </div>
            </div>

            <div class="leisure-body">
                <p class="leisure-story">${card.details.story}</p>
                
                <div class="leisure-gallery">
                    ${card.details.gallery ? card.details.gallery.map(img => `
                        <img src="${img}" class="gallery-img">
                    `).join('') : ''}
                </div>
            </div>
        </div>
    `;
}

function createDetailModal() {
    const m = document.createElement('div');
    m.id = 'detail-modal';
    document.body.appendChild(m);
    return m;
}

function showAboutMe() {
    const modal = document.getElementById('detail-modal') || createDetailModal();
    
    // 1. 设置交互状态，停止自转
    isInteractionActive = true; 
    controls.autoRotate = false;

    // 2. 背景模糊
    container.classList.add('blurred');
    uiLayer.classList.add('hidden');

    modal.innerHTML = `
        <div class="modal-content-wrapper">
            <button class="close-modal" onclick="closeAllModals()">×</button>
            
            <div class="about-modal-content">
                <div class="about-left">
                    <img src="${aboutData.portrait}" class="about-portrait">
                    <a href="${aboutData.cvLink}" class="cv-download-btn" download>Download CV</a>
                </div>
                
                <div class="about-right">
                    <h1 style="font-family:'Cinzel',serif; color:#c0c0c0; margin-bottom:5px;">${aboutData.name}</h1>
                    <p style="color:#888; font-size:0.9rem; margin-bottom:25px;">${aboutData.tagline}</p>
                    
                    <div class="about-bio">${aboutData.bio}</div>
                    
                    <div class="skills-tags">
                        ${aboutData.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                    </div>
                    
                    <div class="about-socials">
                        ${aboutData.socials.map(s => `
                            <a href="${s.url}" class="social-link" title="${s.platform}" target="_blank">${s.icon}</a>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.className = 'active layout-about'; // 使用专属类名
    document.getElementById('close-about-btn').onclick = () => {
        closeAboutMe();
    };
}

// 定义专门关闭 AboutMe 的函数
function closeAboutMe() {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('active');
    container.classList.remove('blurred');
    uiLayer.classList.remove('hidden');

    // 恢复自转状态检查
    isInteractionActive = false;
    checkResumeRotation(); 
}

// 为了防止其他地方（如 HTML 模板）仍在使用，可以把关闭函数挂到全局
window.closeAllModals = closeAboutMe;

// 【关键修改】Camera Focus Logic
// 计算节点当前的世界坐标，并把相机移到它的正前方
function focusNode(nodeId, duration = 1000) {
    const node = nodesMap[nodeId];
    if(!node) return;

    // 1. 获取节点在“地球组”内的局部坐标
    const localPos = latLonToVector3(node.data.lat, node.data.lon, CONFIG.globeRadius);
    
    // 2. 将局部坐标转换为世界坐标 (考虑 earthGroup 的当前旋转)
    // clone() 很重要，否则会修改原始 posLocal
    const worldPos = localPos.clone().applyMatrix4(earthGroup.matrixWorld);

    // 3. 计算目标相机位置
    // 我们希望相机位于 原点(0,0,0) 和 节点世界坐标 的连线上
    // 距离保持当前的相机距离
    const currentDist = camera.position.distanceTo(new THREE.Vector3(0,0,0));
    
    // 归一化方向向量 * 距离 = 目标位置
    const targetPos = worldPos.normalize().multiplyScalar(currentDist);

    new TWEEN.Tween(camera.position)
        .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, duration)
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => controls.update())
        .start();
}


// --- Main ---
initNodes(hierarchy);
document.getElementById('loading').style.display = 'none';

// --- Animation Loop ---
function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    controls.update();

    // 1. Sparkler Animation (仙女棒喷射)
    const positions = sparkSystem.geometry.attributes.position.array;
    const colors = sparkSystem.geometry.attributes.color.array;
    const sizes = sparkSystem.geometry.attributes.size.array;
    const limitRadiusSq = (CONFIG.globeRadius * 1.03) ** 2;

    for (let i = 0; i < sparkCount; i++) {
        const data = sparkData[i];
        const currentDistSq = positions[i*3]*positions[i*3] + positions[i*3+1]*positions[i*3+1] + positions[i*3+2]*positions[i*3+2];
        // 更新生命周期
        data.life += 0.01; // 燃烧速度
        if (data.life > data.maxLife || currentDistSq > limitRadiusSq) {
            data.life = 0;
            // 重置到中心
            positions[i*3] = 0;
            positions[i*3+1] = 0;
            positions[i*3+2] = 0;
            // 重新随机方向
            const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
            data.velocity = dir.multiplyScalar(0.03 + Math.random() * 0.05);
        } else {
            // 移动
            positions[i*3] += data.velocity.x;
            positions[i*3+1] += data.velocity.y;
            positions[i*3+2] += data.velocity.z;
            // 稍微加点重力下垂 (模拟真实烟花)
            data.velocity.y -= 0.001; 
        }

        // 颜色渐变: 白 -> 金 -> 紫 -> 灭
        const progress = data.life / data.maxLife;
        let color = new THREE.Color();
        if (progress < 0.2) color.copy(colorCore); // 核心白
        else if (progress < 0.5) color.lerpColors(colorCore, colorMid, (progress-0.2)/0.3); // 白变金
        else color.lerpColors(colorMid, colorEdge, (progress-0.5)/0.5); // 金变紫
        
        colors[i*3] = color.r;
        colors[i*3+1] = color.g;
        colors[i*3+2] = color.b;

        // 大小渐变
        sizes[i] = data.baseSize * (1 - progress);
    }
    sparkSystem.geometry.attributes.position.needsUpdate = true;
    sparkSystem.geometry.attributes.color.needsUpdate = true;
    sparkSystem.geometry.attributes.size.needsUpdate = true;


    // 2. Rotation Logic (Only rotate if no interaction)
    if (!isInteractionActive) {
        earthGroup.rotation.y += 0.001;
        if (bgMesh) bgMesh.rotation.y += 0.001; 
    }

    // 3. Background Notes Floating
    noteGroup.rotation.y -= 0.0002;
    noteGroup.children.forEach(sprite => {
        sprite.position.y = sprite.userData.yBase + Math.sin(time * 0.001 + sprite.userData.phase) * 3;
    });

    // 4. Sync HTML Labels
    for (const key in nodesMap) {
        const node = nodesMap[key];
        
        if (!node.visible) {
            node.element.style.transform = `translate(-10000px, -10000px)`;
            node.element.style.opacity = 0;
            continue; 
        }

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
            node.element.style.opacity = 0;
            node.element.style.transform = `translate(-10000px, -10000px)`; 
        }
    }
    composer.render();
}

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    
    // 更新所有线条的分辨率
    for (const key in nodesMap) {
        const node = nodesMap[key];
        if (node.lineMesh && node.lineMesh.material.resolution) {
            node.lineMesh.material.resolution.set(w, h);
        }
    }
});

controls.addEventListener('start', () => { 
    // Manual drag stops auto rotation temporarily
    controls.autoRotate = false; 
});

animate();