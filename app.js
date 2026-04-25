// --- CONFIGURACIÓN DE RENDIMIENTO ---
const CONFIG = {
    maxProcessingSize: 800, // Tamaño máximo para procesar con IA (más rápido en móviles)
    outputWidth: 1920,
    outputHeight: 1080,
    carnetWidth: 600,
    carnetHeight: 800
};

// --- GESTIÓN DE EQUIPOS ---
let allTeams = JSON.parse(localStorage.getItem('sportshub_all_teams')) || {};

// MIGRACIÓN: Recuperar equipo de versiones anteriores (v1.1 - v1.3)
const legacyTeam = JSON.parse(localStorage.getItem('sportshub_team'));
if (legacyTeam && legacyTeam.name) {
    const legacyId = "legacy_" + Date.now();
    allTeams[legacyId] = {
        ...legacyTeam,
        id: legacyId,
        code: legacyTeam.name.substring(0,3).toUpperCase()
    };
    localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
    localStorage.removeItem('sportshub_team'); // Limpiar viejo
}

let activeTeamId = localStorage.getItem('sportshub_active_team_id') || "";
if (!activeTeamId && Object.keys(allTeams).length > 0) {
    activeTeamId = Object.keys(allTeams)[0];
}
let editingTeamId = null;

function toggleTeamManager() {
    const tm = document.getElementById('teamManager');
    tm.classList.toggle('hidden');
    if (!tm.classList.contains('hidden')) {
        renderTeamsList();
        closeTeamEditor();
    }
}

function renderTeamsList() {
    const list = document.getElementById('teamsList');
    const strip = document.getElementById('teamStrip');
    list.innerHTML = '';
    strip.innerHTML = '';
    
    Object.entries(allTeams).forEach(([id, team]) => {
        // 1. Card para el Administrador
        const card = document.createElement('div');
        card.className = 'team-item-card';
        card.innerHTML = `
            <img src="${team.shield || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png'}" alt="Shield">
            <h4>${team.name}</h4>
            <button class="update-btn" onclick="editTeam('${id}')" style="margin-top:5px; font-size:0.5rem">EDITAR JUGADORES</button>
        `;
        list.appendChild(card);

        // 2. Item para el Strip Visual (Pantalla principal)
        const stripItem = document.createElement('div');
        stripItem.className = `team-strip-item ${id === activeTeamId ? 'active' : ''}`;
        stripItem.onclick = () => setActiveTeam(id);
        stripItem.innerHTML = `<img src="${team.shield || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png'}" title="${team.name}">`;
        strip.appendChild(stripItem);
    });
}

function setActiveTeam(id) {
    activeTeamId = id;
    localStorage.setItem('sportshub_active_team_id', activeTeamId);
    renderTeamsList();
}

function createNewTeam() {
    editingTeamId = "team_" + Date.now();
    const newTeam = { name: "", color1: "#00ff88", color2: "#00d4ff", shield: null, roster: {} };
    openTeamEditor(newTeam);
}

function editTeam(id) {
    editingTeamId = id;
    openTeamEditor(allTeams[id]);
}

function openTeamEditor(team) {
    document.getElementById('teamEditor').classList.remove('hidden');
    document.getElementById('teamNameInput').value = team.name;
    document.getElementById('teamCodeInput').value = team.code || "";
    document.getElementById('teamCoachInput').value = team.coach || "";
    document.getElementById('teamColor1').value = team.color1;
    document.getElementById('teamColor2').value = team.color2;
    document.getElementById('teamEditor')._selectedShield = team.shield;
    document.getElementById('shieldPreview').src = team.shield || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png';
    renderRosterList(team.roster);
}

function closeTeamEditor() {
    document.getElementById('teamEditor').classList.add('hidden');
    editingTeamId = null;
}

function renderRosterList(roster) {
    const list = document.getElementById('rosterList');
    list.innerHTML = '';
    Object.entries(roster).forEach(([num, player]) => {
        const name = typeof player === 'string' ? player : player.name;
        const pos = player.position ? `<span class="pos-badge">${player.position}</span>` : '';
        const isCap = player.isCaptain ? ' <b title="Capitán">(C)</b>' : '';
        const item = document.createElement('div');
        item.className = 'roster-item';
        item.innerHTML = `<span>${pos}<b>#${num}</b> ${name}${isCap}</span> <button onclick="removePlayer('${num}')">X</button>`;
        list.appendChild(item);
    });
}

function addPlayerToRoster() {
    const num = document.getElementById('playerNum').value;
    const name = document.getElementById('playerName').value;
    const pos = document.getElementById('playerPosition').value;
    const isCap = document.getElementById('isCaptain').checked;
    if (!num || !name || !editingTeamId) return;
    
    const roster = (editingTeamId && allTeams[editingTeamId]) ? allTeams[editingTeamId].roster : {};
    const tempRoster = document.getElementById('teamEditor')._tempRoster || roster;
    
    tempRoster[num] = { 
        name: name.toUpperCase(), 
        position: pos,
        isCaptain: isCap 
    };
    
    document.getElementById('teamEditor')._tempRoster = tempRoster;
    document.getElementById('playerNum').value = '';
    document.getElementById('playerName').value = '';
    document.getElementById('isCaptain').checked = false;
    renderRosterList(tempRoster);
}

function removePlayer(num) {
    const tempRoster = document.getElementById('teamEditor')._tempRoster;
    delete tempRoster[num];
    renderRosterList(tempRoster);
}

async function saveTeam() {
    const teamName = document.getElementById('teamNameInput').value;
    if (!teamName) return alert("Ingresa un nombre de equipo");

    const teamData = {
        id: editingTeamId,
        name: teamName,
        code: document.getElementById('teamCodeInput').value.toUpperCase().substring(0,3) || teamName.substring(0,3).toUpperCase(),
        coach: document.getElementById('teamCoachInput').value.toUpperCase(),
        color1: document.getElementById('teamColor1').value,
        color2: document.getElementById('teamColor2').value,
        roster: document.getElementById('teamEditor')._tempRoster || (allTeams[editingTeamId] ? allTeams[editingTeamId].roster : {}),
        shield: document.getElementById('teamEditor')._selectedShield
    };

    const shieldInput = document.getElementById('shieldInput');
    if (shieldInput.files[0]) {
        teamData.shield = await imageToBase64(shieldInput.files[0]);
    }

    allTeams[editingTeamId] = teamData;
    localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
    
    if (!activeTeamId) activeTeamId = editingTeamId;
    localStorage.setItem('sportshub_active_team_id', activeTeamId);

    // Sync Cloud
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(() => {
            renderTeamsList();
            closeTeamEditor();
            alert("Equipo guardado y sincronizado ✅");
        }).saveAllTeamsData(allTeams);
    } else {
        // Intentar guardar vía API
        fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // GAS requiere no-cors o redirección para POST
            body: JSON.stringify({ action: 'saveAllTeams', data: allTeams })
        }).then(() => {
            renderTeamsList();
            closeTeamEditor();
            alert("Guardado en Local y enviado a Nube ✅");
        }).catch(err => {
            renderTeamsList();
            closeTeamEditor();
            alert("Guardado en Local ✅ (Error nube: " + err.message + ")");
        });
    }
}

function syncWithCloud() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler((response) => {
                    if (Object.keys(response.data).length === 0) {
                        alert("La nube está vacía ☁️. Asegúrate de haber guardado el equipo en el otro dispositivo primero.");
                    } else {
                        allTeams = response.data;
                        localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
                        renderTeamsList();
                        alert("Sincronización completa 🔄 (" + Object.keys(allTeams).length + " equipos)");
                    }
            })
            .getAllTeamsData();
    } else {
        // Fallback vía API fetch
        fetch(`${GAS_WEB_APP_URL}?action=getAllTeamsData`)
            .then(res => res.json())
            .then(response => {
                if (response.success && response.data) {
                    allTeams = response.data;
                    localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
                    renderTeamsList();
                    alert("Sincronización vía API completa 🔄");
                }
            })
            .catch(err => alert("Error al sincronizar: " + err.message));
    }
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
    
    // Obtener equipo activo
    const team = allTeams[activeTeamId] || { name: "DRAFT", code: "DFT", coach: "", color1: "#00ff88", color2: "#00d4ff", roster: {} };
    
    const pData = team.roster[detectedNumber];
    let pName = "JUGADOR #" + detectedNumber;
    let pPos = "";
    if (pData) {
        pName = (typeof pData === 'string' ? pData : pData.name) + (pData.isCaptain ? " (C)" : "");
        pPos = pData.position || "";
    }

    let playerData = {
        name: pName,
        position: pPos,
        team: team.name,
        teamCode: team.code || "SIN",
        color: team.color1,
        color2: team.color2,
        number: detectedNumber,
        shield: team.shield
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
    
    // 4. Guardado Automático en Drive
    updateStep(3, "Subiendo a Drive...");
    await saveToDrive(elements.outputCanvas.toDataURL('image/png'), finalData);
    
    updateStep(3, "Listo para descargar");
    
    // 5. Mostrar Resultados
    setTimeout(() => {
        elements.processingArea.classList.add('hidden');
        elements.resultArea.classList.remove('hidden');
    }, 500);
}

async function saveToDrive(base64, player) {
    // Usar el código personalizado o fallback a 3 letras del nombre
    const teamCode = player.teamCode || (player.team || "SIN").substring(0, 3).toUpperCase();
    const fileName = `${teamCode}_${player.number}_${player.name.replace(/\s+/g, '_')}.png`;
    const teamName = player.team || "SIN_EQUIPO";

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve) => {
            google.script.run
                .withSuccessHandler((res) => {
                    console.log("Guardado en Drive:", res.url);
                    resolve(res);
                })
                .saveProcessedImage(base64, fileName, teamName);
        });
    } else {
        console.warn("Modo Local: No se puede guardar en Drive directamente.");
        // Podríamos intentar un fetch POST al GAS_WEB_APP_URL aquí si el usuario lo necesita
    }
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
    if (player.shield) {
        const shieldImg = new Image();
        shieldImg.src = player.shield;
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
    
    // 1. Fondo Glassmorphism
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.roundRect(100, bY, 1720, 120, 15);
    ctx.fill();
    
    // 2. Barras laterales de color (Bicolor)
    ctx.fillStyle = player.color;
    ctx.fillRect(100, bY, 15, 60);
    ctx.fillStyle = player.color2 || player.color;
    ctx.fillRect(100, bY + 60, 15, 60);

    // 3. Posición Badge
    let textX = 140;
    if (player.position) {
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.roundRect(135, bY + 35, 90, 50, 8);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "900 30px Outfit";
        ctx.textAlign = "center";
        ctx.fillText(player.position, 180, bY + 72);
        textX = 250;
    }

    // 4. Nombre y Número
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFF";
    ctx.font = "900 65px Outfit";
    ctx.fillText(`${player.number} | ${player.name}`, textX, bY + 82);

    // 5. Nombre del Equipo (Derecha)
    ctx.textAlign = "right";
    ctx.font = "700 35px Outfit";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(player.team.toUpperCase(), 1780, bY + 75);
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
    const highResUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    
    // Mostrar feedback de carga
    const grid = document.getElementById('shieldGrid');
    const oldContent = grid.innerHTML;
    grid.innerHTML = '<p class="loading-text">Procesando escudo...</p>';

    try {
        const base64 = await urlToBase64(highResUrl);
        document.getElementById('teamEditor')._selectedShield = base64;
        document.getElementById('shieldPreview').src = base64;
        
        alert("Escudo seleccionado ✅");
        closeShieldGallery();
    } catch(e) {
        document.getElementById('teamEditor')._selectedShield = highResUrl;
        document.getElementById('shieldPreview').src = highResUrl;
        alert("Escudo vinculado (URL) ✅");
        closeShieldGallery();
    }
}

async function previewLocalShield(input) {
    if (input.files && input.files[0]) {
        const base64 = await imageToBase64(input.files[0]);
        document.getElementById('teamEditor')._selectedShield = base64;
        document.getElementById('shieldPreview').src = base64;
    }
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
// --- INICIALIZACIÓN ---
renderTeamsList();
