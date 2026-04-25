// --- CONFIGURACIÓN DE RENDIMIENTO ---
const CONFIG = {
    maxProcessingSize: 800, // Tamaño máximo para procesar con IA (más rápido en móviles)
    outputWidth: 1920,
    outputHeight: 1080,
    carnetWidth: 600,
    carnetHeight: 800
};

const elements = {
    imageInput: document.getElementById('imageInput'),
    uploadSection: document.querySelector('.upload-section'),
    processingArea: document.getElementById('processingArea'),
    resultArea: document.getElementById('resultArea'),
    inputCanvas: document.getElementById('inputCanvas'),
    outputCanvas: document.getElementById('outputCanvas'),
    carnetCanvas: document.getElementById('carnetCanvas'),
    ocrStatus: document.getElementById('ocrStatus'),
    segStatus: document.getElementById('segStatus'),
    layoutStatus: document.getElementById('layoutStatus')
};

let selfieSegmentation;

// Inicializar MediaPipe con carga diferida para optimizar inicio
async function initMediaPipe() {
    try {
        selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        selfieSegmentation.setOptions({ modelSelection: 1 });
    } catch (e) {
        console.error("Error al cargar MediaPipe:", e);
    }
}

initMediaPipe();

// --- EVENTOS ---
elements.imageInput.addEventListener('change', handleImageUpload);

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Mostrar UI de carga inmediatamente
    elements.uploadSection.classList.add('hidden');
    elements.processingArea.classList.remove('hidden');

    const img = await loadImage(file);
    
    // Optimizar imagen para procesamiento (Redimensionar si es muy grande)
    const processingImg = await resizeImage(img, CONFIG.maxProcessingSize);
    
    processPlayerPhoto(processingImg, img); // Usamos la original para el resultado final HD
}

async function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function resizeImage(img, maxSize) {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    if (width > height) {
        if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
        }
    } else {
        if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
        }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    const resizedImg = new Image();
    resizedImg.src = canvas.toDataURL('image/jpeg', 0.8);
    await new Promise(r => resizedImg.onload = r);
    return resizedImg;
}

async function processPlayerPhoto(processingImg, originalImg) {
    // Dibujar en canvas de entrada (preview)
    const ctxIn = elements.inputCanvas.getContext('2d');
    elements.inputCanvas.width = processingImg.width;
    elements.inputCanvas.height = processingImg.height;
    ctxIn.drawImage(processingImg, 0, 0);

    // 1. OCR - Detectar Número
    updateStep(1, "Buscando dorsal...");
    const ocrResult = await Tesseract.recognize(processingImg, 'eng');
    const detectedNumber = extractNumber(ocrResult.data.text);
    const playerData = window.PLAYER_DATABASE[detectedNumber] || window.PLAYER_DATABASE["DEFAULT"];
    updateStep(1, `Identificado: #${detectedNumber}`);

    // 2. Segmentación - Quitar Fondo
    updateStep(2, "IA de recorte...");
    const transparentPlayer = await removeBackground(processingImg);
    updateStep(2, "Recorte completado");

    // 3. Composición de Layout
    updateStep(3, "Creando arte HD...");
    await generateLayouts(transparentPlayer, playerData);
    updateStep(3, "Listo para descargar");
    
    // 4. Mostrar Resultados
    setTimeout(() => {
        elements.processingArea.classList.add('hidden');
        elements.resultArea.classList.remove('hidden');
    }, 500);
}

function extractNumber(text) {
    // Busca números de 1 o 2 dígitos rodeados de espacio o bordes
    const matches = text.match(/(?:^|\s)(\d{1,2})(?:\s|$)/g);
    if (matches) {
        return matches[0].trim();
    }
    return "??";
}

async function removeBackground(img) {
    return new Promise((resolve) => {
        selfieSegmentation.onResults((results) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            
            resolve(canvas);
        });
        selfieSegmentation.send({ image: img });
    });
}

async function generateLayouts(playerCanvas, player) {
    // --- CANVAS PRINCIPAL (Transmisión) ---
    const ctxOut = elements.outputCanvas.getContext('2d');
    elements.outputCanvas.width = CONFIG.outputWidth;
    elements.outputCanvas.height = CONFIG.outputHeight;

    // Fondo Tech/Deportivo
    drawBackground(ctxOut, player.color);

    // Jugador (Escalado inteligente)
    const scale = (CONFIG.outputHeight * 0.85) / playerCanvas.height;
    const pW = playerCanvas.width * scale;
    const pH = playerCanvas.height * scale;
    ctxOut.save();
    ctxOut.shadowColor = "rgba(0,0,0,0.5)";
    ctxOut.shadowBlur = 30;
    ctxOut.drawImage(playerCanvas, (CONFIG.outputWidth - pW) / 2, CONFIG.outputHeight - pH, pW, pH);
    ctxOut.restore();

    // Ticker Pro
    drawSportsTicker(ctxOut, player);

    // --- CANVAS CARNET ---
    const ctxCar = elements.carnetCanvas.getContext('2d');
    elements.carnetCanvas.width = CONFIG.carnetWidth;
    elements.carnetCanvas.height = CONFIG.carnetHeight;

    // Fondo Carnet
    ctxCar.fillStyle = "#111";
    ctxCar.fillRect(0, 0, CONFIG.carnetWidth, CONFIG.carnetHeight);
    
    // Acento de color lateral
    ctxCar.fillStyle = player.color;
    ctxCar.fillRect(0, 0, 40, CONFIG.carnetHeight);

    // Foto Jugador
    const cScale = (CONFIG.carnetHeight * 0.7) / playerCanvas.height;
    const cW = playerCanvas.width * cScale;
    const cH = playerCanvas.height * cScale;
    ctxCar.drawImage(playerCanvas, (CONFIG.carnetWidth - cW) / 2 + 20, 50, cW, cH);
    
    // Datos
    ctxCar.fillStyle = "white";
    ctxCar.font = "900 50px Oswald";
    ctxCar.fillText(player.name, 70, 700);
    ctxCar.font = "400 30px Outfit";
    ctxCar.fillStyle = "rgba(255,255,255,0.5)";
    ctxCar.fillText(player.team, 70, 740);
    
    // Número
    ctxCar.fillStyle = player.color;
    ctxCar.font = "900 120px Oswald";
    ctxCar.textAlign = "right";
    ctxCar.fillText(player.name.charAt(0) == "J" ? "?" : "?", 550, 750);
}

function drawBackground(ctx, color) {
    const grd = ctx.createRadialGradient(960, 540, 100, 960, 540, 1000);
    grd.addColorStop(0, "#1a2533");
    grd.addColorStop(1, "#0a0e14");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1920, 1080);

    // Líneas de campo estilizadas
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 2;
    for(let i=0; i<10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 150);
        ctx.lineTo(1920, i * 150 + 200);
        ctx.stroke();
    }
}

function drawSportsTicker(ctx, player) {
    const bY = 1080 - 180;
    
    // Glassmorphism Ticker
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(100, bY, 1720, 120);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(100, bY, 1720, 120);
    
    // Acento Color
    ctx.fillStyle = player.color;
    ctx.fillRect(100, bY, 15, 120);

    // Texto Nombre
    ctx.fillStyle = "white";
    ctx.font = "900 70px Oswald";
    ctx.textAlign = "left";
    ctx.fillText(player.name, 150, bY + 85);
    
    // Team
    ctx.font = "400 35px Outfit";
    ctx.fillStyle = "rgba(0, 255, 136, 1)";
    ctx.fillText(player.team, 150, bY + 35);

    // Escudo/Círculo Número
    ctx.beginPath();
    ctx.arc(1750, bY + 60, 45, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    
    ctx.fillStyle = "white";
    ctx.font = "900 50px Oswald";
    ctx.textAlign = "center";
    ctx.fillText("#", 1750, bY + 78);
}

function updateStep(num, text) {
    const el = document.getElementById(`step${num}`);
    if (!el) return;
    const status = el.querySelector('p');
    status.innerText = text;
    
    // Remover active de otros y poner en este
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
}

function downloadImage(canvasId, name) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = `sportshub_${name}_${Date.now()}.png`;
    
    // Intentar WebP para mayor compresión si es para web, pero PNG es más compatible para descarga
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function resetApp() {
    elements.resultArea.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    elements.imageInput.value = '';
}
