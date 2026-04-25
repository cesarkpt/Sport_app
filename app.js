// --- CONFIGURACIÓN DE RENDIMIENTO ---
const CONFIG = {
    maxProcessingSize: 800, // Tamaño máximo para procesar con IA (más rápido en móviles)
    outputWidth: 1920,
    outputHeight: 1080,
    carnetWidth: 600,
    carnetHeight: 800
};

// --- GESTIÓN DE EQUIPO ---
let currentTeam = JSON.parse(localStorage.getItem('sportshub_team')) || {
    name: "",
    color1: "#00ff88",
    color2: "#00d4ff",
    shield: null,
    roster: {}
};

function toggleTeamManager() {
    const tm = document.getElementById('teamManager');
    tm.classList.toggle('hidden');
    if (!tm.classList.contains('hidden')) {
        loadTeamIntoUI();
    }
}

function loadTeamIntoUI() {
    document.getElementById('teamNameInput').value = currentTeam.name;
    document.getElementById('teamColor1').value = currentTeam.color1;
    document.getElementById('teamColor2').value = currentTeam.color2;
    renderRosterList();
}

function addPlayerToRoster() {
    const num = document.getElementById('playerNum').value;
    const name = document.getElementById('playerName').value;
    if (!num || !name) return;
    
    currentTeam.roster[num] = name.toUpperCase();
    document.getElementById('playerNum').value = '';
    document.getElementById('playerName').value = '';
    renderRosterList();
}

function renderRosterList() {
    const list = document.getElementById('rosterList');
    list.innerHTML = '';
    Object.entries(currentTeam.roster).forEach(([num, name]) => {
        const item = document.createElement('div');
        item.className = 'roster-item';
        item.innerHTML = `<span>#${num}</span> ${name} <button onclick="removePlayer('${num}')">ELIMINAR</button>`;
        list.appendChild(item);
    });
}

function removePlayer(num) {
    delete currentTeam.roster[num];
    renderRosterList();
}

async function saveTeam() {
    currentTeam.name = document.getElementById('teamNameInput').value;
    currentTeam.color1 = document.getElementById('teamColor1').value;
    currentTeam.color2 = document.getElementById('teamColor2').value;
    
    const shieldInput = document.getElementById('shieldInput');
    if (shieldInput.files[0]) {
        currentTeam.shield = await imageToBase64(shieldInput.files[0]);
    }
    
    localStorage.setItem('sportshub_team', JSON.stringify(currentTeam));
    alert("Equipo guardado correctamente");
    toggleTeamManager();
}

async function imageToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

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

    updateStep(1, "Escaneando dorsal...");
    const ocrResult = await Tesseract.recognize(processingImg, 'eng');
    const detectedNumber = extractNumber(ocrResult.data.text);
    
    // Buscar en Nómina del Equipo Primero
    let playerData = {
        name: currentTeam.roster[detectedNumber] || "JUGADOR #" + detectedNumber,
        team: currentTeam.name || "DRAFT",
        color: currentTeam.color1,
        color2: currentTeam.color2,
        number: detectedNumber
    };

    updateStep(1, "Dorsal detectado: #" + detectedNumber);

    // --- PAUSA PARA CORRECCIÓN MANUAL ---
    const finalData = await waitForManualCorrection(playerData, detectedNumber);
    
    // 2. Segmentación - Quitar Fondo
    updateStep(2, "IA de recorte...");
    const transparentPlayer = await removeBackground(processingImg);
    updateStep(2, "Recorte completado");

    // 3. Composición de Layout
    updateStep(3, "Creando arte HD...");
    await generateLayouts(transparentPlayer, finalData);
    updateStep(3, "Listo para descargar");
    
    // 4. Mostrar Resultados
    setTimeout(() => {
        elements.processingArea.classList.add('hidden');
        elements.resultArea.classList.remove('hidden');
    }, 500);
}

async function waitForManualCorrection(initialData, detectedNumber) {
    const editPanel = document.getElementById('editPanel');
    const editName = document.getElementById('editName');
    const editNumber = document.getElementById('editNumber');
    const editTeam = document.getElementById('editTeam');
    const confirmBtn = document.getElementById('confirmEditBtn');

    // Poblar campos
    editName.value = initialData.name;
    editNumber.value = detectedNumber === "??" ? "" : detectedNumber;
    editTeam.value = initialData.team;

    // Mostrar panel
    editPanel.classList.remove('hidden');

    return new Promise((resolve) => {
        confirmBtn.onclick = () => {
            const updatedData = {
                name: editName.value.toUpperCase(),
                team: editTeam.value.toUpperCase(),
                number: editNumber.value,
                color: initialData.color || "#00ff88",
                color2: initialData.color2 || "#00d4ff"
            };
            editPanel.classList.add('hidden');
            resolve(updatedData);
        };
    });
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

            // 1. Dibujar máscara con suavizado (Feathering)
            ctx.save();
            ctx.filter = 'blur(3px)'; // Suaviza los bordes de la máscara
            ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            
            // 2. Extraer jugador con bordes suaves
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

    // Jugador (Escalado inteligente con efectos de profundidad)
    const scale = (CONFIG.outputHeight * 0.85) / playerCanvas.height;
    const pW = playerCanvas.width * scale;
    const pH = playerCanvas.height * scale;
    
    ctxOut.save();
    // Efecto 1: Sombra profunda para despegar del fondo
    ctxOut.shadowColor = "rgba(0,0,0,0.8)";
    ctxOut.shadowBlur = 40;
    ctxOut.shadowOffsetX = 0;
    ctxOut.shadowOffsetY = 20;
    
    // Efecto 2: Brillo sutil en los bordes (Rim Light) para disimular recortes
    // (Dibujamos el jugador dos veces, una con glow)
    ctxOut.drawImage(playerCanvas, (CONFIG.outputWidth - pW) / 2, CONFIG.outputHeight - pH, pW, pH);
    
    ctxOut.globalCompositeOperation = 'source-over';
    ctxOut.shadowBlur = 10;
    ctxOut.shadowColor = "rgba(255,255,255,0.2)";
    ctxOut.drawImage(playerCanvas, (CONFIG.outputWidth - pW) / 2, CONFIG.outputHeight - pH, pW, pH);
    ctxOut.restore();

    // Dibujar Escudo arriba a la derecha
    if (currentTeam.shield) {
        const shieldImg = new Image();
        shieldImg.src = currentTeam.shield;
        await new Promise(r => shieldImg.onload = r);
        
        ctxOut.save();
        ctxOut.shadowColor = "rgba(0,0,0,0.3)";
        ctxOut.shadowBlur = 20;
        ctxOut.drawImage(shieldImg, CONFIG.outputWidth - 250, 50, 200, 200);
        ctxOut.restore();
    }

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
    ctxCar.fillText(player.number || "??", 550, 750);
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
    
    // Barra de colores bicolor tipo ticker
    ctx.fillStyle = player.color;
    ctx.fillRect(100, bY, 15, 60);
    ctx.fillStyle = player.color2 || player.color;
    ctx.fillRect(100, bY + 60, 15, 60);

    // Texto Nombre
    ctx.fillStyle = "white";
    ctx.font = "900 70px Oswald";
    ctx.textAlign = "left";
    ctx.fillText(player.name, 150, bY + 85);
    
    // Team
    ctx.font = "400 35px Outfit";
    ctx.fillStyle = player.color;
    ctx.fillText(player.team, 150, bY + 35);

    // Escudo/Círculo Número
    ctx.beginPath();
    ctx.arc(1750, bY + 60, 45, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    
    ctx.fillStyle = "white";
    ctx.font = "900 50px Oswald";
    ctx.textAlign = "center";
    ctx.fillText(player.number || "#", 1750, bY + 78);
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

function toggleUpdates() {
    const modal = document.getElementById('updatesModal');
    modal.classList.toggle('hidden');
}

// --- GALERÍA DE ESCUDOS (DRIVE) ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYBhBQSZzSI5qj9cRgLhjQ-YGonuqnNBTmMRXJH6OllT3XpO0KTXBZP0wOPWv1i4nk/exec";

function openShieldGallery() {
    document.getElementById('shieldGalleryModal').classList.remove('hidden');
    const grid = document.getElementById('shieldGrid');
    grid.innerHTML = '<p class="loading-text">Conectando con Google Drive...</p>';

    // 1. Intentar llamar a Google Apps Script (Si estamos dentro del entorno GAS)
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(renderShieldGallery)
            .withFailureHandler(handleShieldError)
            .getShieldsFromDrive();
    } 
    // 2. Fallback: Llamada vía API a la Web App desplegada (Si estamos en local/GitHub)
    else {
        fetch(`${GAS_WEB_APP_URL}?action=getShields`)
            .then(response => response.json())
            .then(data => renderShieldGallery(data))
            .catch(err => {
                grid.innerHTML = `
                    <div class="loading-text">
                        <p>⚠️ Error de conexión con la API.</p>
                        <p style="font-size: 0.6rem; margin-top: 10px;">${err.message}</p>
                        <button class="btn-primary" onclick="simulateShields()" style="margin-top: 15px; font-size: 0.7rem;">USAR ESCUDOS DE PRUEBA</button>
                    </div>
                `;
            });
    }
}

function closeShieldGallery() {
    document.getElementById('shieldGalleryModal').classList.add('hidden');
}

function renderShieldGallery(response) {
    const grid = document.getElementById('shieldGrid');
    grid.innerHTML = '';

    if (!response.success) {
        grid.innerHTML = `<p class="loading-text">Error: ${response.error}</p>`;
        return;
    }

    if (response.data.length === 0) {
        grid.innerHTML = '<p class="loading-text">No se encontraron imágenes en la carpeta.</p>';
        return;
    }

    response.data.forEach(shield => {
        const item = document.createElement('div');
        item.className = 'shield-item';
        item.onclick = () => selectShield(shield.id);
        item.innerHTML = `
            <img src="${shield.url}" alt="${shield.name}">
            <span>${shield.name}</span>
        `;
        grid.appendChild(item);
    });
}

function handleShieldError(err) {
    document.getElementById('shieldGrid').innerHTML = `<p class="loading-text">Error de conexión: ${err}</p>`;
}

async function selectShield(fileId) {
    // Generar la URL de alta resolución para el canvas
    const highResUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    
    // Intentar convertir a Base64 para guardarlo en localStorage
    // (Nota: Esto puede dar CORS si se corre localmente, pero en GAS funciona mejor)
    try {
        const base64 = await urlToBase64(highResUrl);
        currentTeam.shield = base64;
    } catch(e) {
        currentTeam.shield = highResUrl;
    }
    
    alert("Escudo seleccionado correctamente.");
    closeShieldGallery();
}

async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return url;
    }
}

function simulateShields() {
    const mockData = {
        success: true,
        data: [
            { id: "1BZ9_Qn6g2AvtPD8A3eShmIv2_H7SZioR", name: "Ejemplo 1", url: "https://cdn-icons-png.flaticon.com/512/5351/5351333.png" },
            { id: "1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO", name: "Ejemplo 2", url: "https://cdn-icons-png.flaticon.com/512/5351/5351333.png" }
        ]
    };
    renderShieldGallery(mockData);
}
