console.log("🚀 Sports Hub Pro v1.4.2 cargado correctamente.");
// --- CONFIGURACIÓN DE RENDIMIENTO ---
const CONFIG = {
    maxProcessingSize: 800, // Tamaño máximo para procesar con IA (más rápido en móviles)
    outputWidth: 1920,
    outputHeight: 1080,
    carnetWidth: 600,
    carnetHeight: 800
};

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYBhBQSZzSI5qj9cRgLhjQ-YGonuqnNBTmMRXJH6OllT3XpO0KTXBZP0wOPWv1i4nk/exec";

// --- GESTIÓN DE EQUIPOS ---
let allTeams = JSON.parse(localStorage.getItem('sportshub_all_teams')) || {};

// MIGRACIÓN: Recuperar equipo de versiones anteriores (v1.1 - v1.3)
const legacyTeam = JSON.parse(localStorage.getItem('sportshub_team'));
if (legacyTeam && legacyTeam.name) {
    const legacyId = "legacy_" + Date.now();
    allTeams[legacyId] = {
        ...legacyTeam,
        id: legacyId,
        code: legacyTeam.name.substring(0, 3).toUpperCase()
    };
    localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
    localStorage.removeItem('sportshub_team'); // Limpiar viejo
}

let activeTeamId = localStorage.getItem('sportshub_active_team_id') || "";
if (!activeTeamId && Object.keys(allTeams).length > 0) {
    activeTeamId = Object.keys(allTeams)[0];
}
let editingTeamId = null;
let lastProcessedPlayerImg = null;
let lastProcessedCropHD = null;
let lastProcessedCrop = null;
let lastShouldRemoveBg = false;
let lastPlayerData = null;

let arteStateSq = { img: null, x: 0, y: 0, scale: 1, rotate: 0, isDragging: false, startX: 0, startY: 0, woodImg: null, data: null };
let arteStateVer = { img: null, x: 0, y: 0, scale: 1, rotate: 0, isDragging: false, startX: 0, startY: 0, woodImg: null, data: null };

function toggleTeamManager() {
    const tm = document.getElementById('teamManager');
    tm.classList.toggle('hidden');
    if (!tm.classList.contains('hidden')) {
        renderTeamsList();
        closeTeamEditor();
    }
}

async function syncWithCloud() {
    const btn = document.getElementById('btnSyncCloud');
    if (!btn) return console.error("No se encontró el botón de sincronización.");

    const originalText = btn.innerHTML;
    btn.innerHTML = "CONECTANDO... ⏳";
    btn.disabled = true;

    // Timeout de seguridad de 12 segundos
    const syncTimeout = setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert("⚠️ EL SERVIDOR TARDA DEMASIADO\nEs posible que Google esté saturado o necesites iniciar sesión nuevamente.");
    }, 12000);

    try {
        let result = null;

        if (typeof google !== 'undefined' && google.script && google.script.run) {
            // Caso 1: Dentro de Google Apps Script
            result = await new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(res => resolve(res))
                    .withFailureHandler(err => reject(err))
                    .getAllTeamsData();
            });
        } else {
            // Caso 2: Web App externa
            const response = await fetch(`${GAS_WEB_APP_URL}?action=getAllTeamsData`);
            result = await response.json();
        }

        clearTimeout(syncTimeout);

        if (result && result.success) {
            if (result.data && Object.keys(result.data).length > 0) {
                allTeams = result.data;
                localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
                renderTeamsList();
                alert("¡Sincronización Exitosa! ✅\nSe han actualizado " + Object.keys(allTeams).length + " equipos.");
            } else {
                alert("La base de datos en la nube está vacía. ☁️");
            }
        } else {
            alert("El servidor no envió datos válidos: " + (result ? result.error : "Desconocido"));
        }
    } catch (e) {
        clearTimeout(syncTimeout);
        console.error("Critical Sync Error:", e);
        alert("FALLO DE CONEXIÓN:\n" + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
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

let currentShieldType = 'main';

function openTeamEditor(team) {
    document.getElementById('teamEditor').classList.remove('hidden');
    document.getElementById('teamNameInput').value = team.name;
    document.getElementById('teamCodeInput').value = team.code || "";
    document.getElementById('teamCoachInput').value = team.coach || "";
    document.getElementById('teamColor1').value = team.color1;
    document.getElementById('teamColor2').value = team.color2;

    document.getElementById('teamEditor')._selectedShield = team.shield;
    document.getElementById('teamEditor')._selectedShieldWhite = team.shieldWhite;

    document.getElementById('shieldPreview').src = team.shield || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png';
    document.getElementById('shieldWhitePreview').src = team.shieldWhite || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png';

    renderRosterList(team.roster);
}

function closeTeamEditor() {
    document.getElementById('teamEditor').classList.add('hidden');
    editingTeamId = null;
}

function renderRosterList(roster) {
    const list = document.getElementById('rosterList');
    list.innerHTML = '';

    // Guardar referencia al roster actual en el DOM
    document.getElementById('teamEditor')._tempRoster = roster;

    Object.entries(roster).forEach(([num, player]) => {
        const name = typeof player === 'string' ? player : player.name;
        const pos = player.position || "DEL";

        const item = document.createElement('div');
        item.className = 'roster-item-editable';
        item.innerHTML = `
            <input type="number" value="${num}" class="edit-num" onchange="updatePlayerInRoster('${num}', 'number', this.value)">
            <input type="text" value="${name}" class="edit-name" onchange="updatePlayerInRoster('${num}', 'name', this.value)">
            <select class="edit-pos" onchange="updatePlayerInRoster('${num}', 'position', this.value)">
                <option value="POR" ${pos === 'POR' ? 'selected' : ''}>POR</option>
                <option value="DEF" ${pos === 'DEF' ? 'selected' : ''}>DEF</option>
                <option value="VOL" ${pos === 'VOL' ? 'selected' : ''}>VOL</option>
                <option value="DEL" ${pos === 'DEL' ? 'selected' : ''}>DEL</option>
            </select>
            <button class="delete-btn" onclick="removePlayer('${num}')">×</button>
        `;
        list.appendChild(item);
    });
}

function updatePlayerInRoster(num, field, value) {
    const roster = document.getElementById('teamEditor')._tempRoster;
    if (!roster[num]) return;

    if (field === 'number') {
        const playerData = roster[num];
        delete roster[num];
        roster[value] = playerData;
        renderRosterList(roster); // Re-render para actualizar referencias
    } else {
        roster[num][field] = value.toUpperCase();
    }
}

function setPos(btn, pos) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    btn.dataset.val = pos;
}

function toggleCap(btn) {
    btn.classList.toggle('active');
}

function addPlayerToRoster() {
    const num = document.getElementById('playerNum').value;
    const name = document.getElementById('playerName').value;
    const activePosBtn = document.querySelector('#rosterPosBtns .pos-btn.active');
    const pos = activePosBtn ? activePosBtn.innerText : "DEL";
    const isCap = document.getElementById('rosterCapBtn').classList.contains('active');

    if (!num || !name) return alert("Completa número y nombre");

    const roster = (editingTeamId && allTeams[editingTeamId]) ? allTeams[editingTeamId].roster : {};

    roster[num] = {
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
        code: document.getElementById('teamCodeInput').value.toUpperCase().substring(0, 3) || teamName.substring(0, 3).toUpperCase(),
        coach: document.getElementById('teamCoachInput').value.toUpperCase(),
        color1: document.getElementById('teamColor1').value,
        color2: document.getElementById('teamColor2').value,
        roster: document.getElementById('teamEditor')._tempRoster || (allTeams[editingTeamId] ? allTeams[editingTeamId].roster : {}),
        shield: document.getElementById('teamEditor')._selectedShield,
        shieldWhite: document.getElementById('teamEditor')._selectedShieldWhite
    };

    const shieldInput = document.getElementById('shieldInput');
    if (shieldInput.files[0]) teamData.shield = await imageToBase64(shieldInput.files[0]);

    const shieldWhiteInput = document.getElementById('shieldWhiteInput');
    if (shieldWhiteInput.files[0]) teamData.shieldWhite = await imageToBase64(shieldWhiteInput.files[0]);

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

    // 1. Mostrar preview inmediato escalado al contenedor
    const container = elements.inputCanvas.parentElement;
    const maxW = container ? container.clientWidth : 600;
    const maxH = container ? container.clientHeight : 400;
    const scale = Math.max(maxW / img.width, maxH / img.height);
    elements.inputCanvas.width = Math.round(img.width * scale);
    elements.inputCanvas.height = Math.round(img.height * scale);
    const ctx = elements.inputCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, elements.inputCanvas.width, elements.inputCanvas.height);

    // 2. Optimizar para IA
    const processingImg = await resizeImage(img, CONFIG.maxProcessingSize);

    processPlayerPhoto(processingImg, img);
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

function extractNumber(text) {
    if (!text) return "??";
    // Limpiar caracteres extraños y buscar números
    const match = text.replace(/[^0-9]/g, '').match(/\d+/);
    if (!match) return "??";
    let num = match[0];
    // Quitar ceros a la izquierda si tiene más de 1 dígito (ej: 01 -> 1)
    if (num.length > 1 && num.startsWith('0')) num = num.substring(1);
    return num;
}

async function processPlayerPhoto(processingImg, originalImg) {
    try {
        // Dibujar en canvas de entrada por si acaso no se hizo
        const ctxIn = elements.inputCanvas.getContext('2d');
        if (elements.inputCanvas.width === 0) {
            elements.inputCanvas.width = processingImg.width;
            elements.inputCanvas.height = processingImg.height;
            ctxIn.drawImage(processingImg, 0, 0);
        }

        updateStep(1, "Analizando dorsal...");
        const ocrResult = await recognizeText(processingImg);
        let detectedNumber = extractNumber(ocrResult.data.text);

        // Obtener equipo activo
        const team = allTeams[activeTeamId] || { name: "DRAFT", code: "DFT", coach: "", color1: "#00ff88", color2: "#00d4ff", roster: {} };

        // INTELIGENCIA: Si el número detectado no está en la nómina, 
        // pero al invertirlo sí está, sugerir el invertido (ej: 01 -> 10)
        if (!team.roster[detectedNumber]) {
            const reversed = detectedNumber.split('').reverse().join('');
            if (team.roster[reversed]) {
                console.log(`OCR Flip detectado: ${detectedNumber} -> ${reversed}`);
                detectedNumber = reversed;
            }
        }
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

        // --- IA DE RECORTE (Si está activa) ---
        const shouldRemoveBg = document.getElementById('bgToggle').checked;
        let finalPlayerImg;
        if (shouldRemoveBg) {
            updateStep(2, "IA de recorte...");
            finalPlayerImg = await removeBackground(originalImg);
            updateStep(2, "Recorte completado");
        } else {
            updateStep(2, "Fondo original conservado");
            finalPlayerImg = originalImg;
        }

        // --- PAUSA PARA CORRECCIÓN MANUAL Y ENCUADRE ---
        const finalData = await waitForManualCorrection(playerData, detectedNumber, finalPlayerImg);

        // 3. Guardar estado global
        lastProcessedPlayerImg = finalPlayerImg;
        lastProcessedCropHD = finalData.cropHD;
        lastProcessedCrop = finalData.crop;
        lastShouldRemoveBg = shouldRemoveBg;
        lastPlayerData = finalData.data;
        currentPlayerData = finalData.data;

        // Preparar carrusel en segundo plano (sin generar canvas aún)
        initCarouselWithPhoto(finalPlayerImg);

        updateStep(3, "¡Listo! Elige qué generar.");

        // 4. Mostrar panel de acciones
        setTimeout(() => {
            elements.processingArea.classList.add('hidden');
            elements.resultArea.classList.remove('hidden');
            document.getElementById('actionPanel').classList.remove('hidden');
            showResultTab('previas');
        }, 400);

    } catch (error) {
        console.error("Error en procesamiento:", error);
        alert("Ocurrió un error al analizar la foto. Intentaremos continuar manualmente.");
        const fallbackData = { name: "ERROR IA", team: "DESCONOCIDO", number: "??", position: "DEL", teamCode: "DFT", color: "#777", color2: "#777" };
        const corrected = await waitForManualCorrection(fallbackData, "??", originalImg);
        lastProcessedPlayerImg = originalImg;
        lastProcessedCropHD = corrected.cropHD;
        lastProcessedCrop = corrected.crop;
        lastShouldRemoveBg = false;
        lastPlayerData = corrected.data;
        currentPlayerData = corrected.data;
        initCarouselWithPhoto(originalImg);
        elements.processingArea.classList.add('hidden');
        elements.resultArea.classList.remove('hidden');
        document.getElementById('actionPanel').classList.remove('hidden');
        showResultTab('previas');
    }
}

// --- GENERADORES INDIVIDUALES POR FORMATO ---

async function runGenTarjetaHD() {
    if (!lastProcessedPlayerImg) return;
    const btn = document.getElementById('btnGenTarjeta');
    if (btn) { btn.innerHTML = '⏳ Generando...'; btn.disabled = true; }
    await generateLayouts(lastProcessedPlayerImg, lastPlayerData, lastShouldRemoveBg, lastProcessedCrop, lastProcessedCropHD);
    showResultTab('previas');
    if (btn) { btn.innerHTML = '📺 PLANO TV'; btn.disabled = false; }
}

async function runGenCarnet() {
    if (!lastProcessedPlayerImg) return;
    const btn = document.getElementById('btnGenCarnet');
    if (btn) { btn.innerHTML = '⏳ Generando...'; btn.disabled = true; }
    await generateLayouts(lastProcessedPlayerImg, lastPlayerData, lastShouldRemoveBg, lastProcessedCrop, lastProcessedCropHD);
    showResultTab('previas');
    document.getElementById('carnetCanvas').scrollIntoView({ behavior: 'smooth' });
    if (btn) { btn.innerHTML = '🃏 CROMO'; btn.disabled = false; }
}

async function runGenPostales() {
    if (!lastProcessedPlayerImg) return;
    const btn = document.getElementById('btnGenPostales');
    if (btn) { btn.innerHTML = '⏳ Generando...'; btn.disabled = true; }
    await generateMatchPostals();
    showResultTab('postales');
    if (btn) { btn.innerHTML = 'ℹ️ INFO RS'; btn.disabled = false; }
}

async function runGenArte() {
    if (!lastProcessedPlayerImg) return;
    const btn = document.getElementById('btnGenArte');
    if (btn) { btn.innerHTML = '⏳ Generando...'; btn.disabled = true; }
    await generateArteLayouts(lastProcessedPlayerImg, lastPlayerData, lastProcessedCropHD);
    showResultTab('arte');
    if (btn) { btn.innerHTML = '📸 POLAROID'; btn.disabled = false; }
}

function runGenCarrusel() {
    document.getElementById('resultArea').classList.remove('hidden');
    showResultTab('carousel');
    // Re-calcular posición ahora que el contenedor es visible
    setTimeout(() => {
        if (carouselState.img) {
            resetCarouselPosition();
            setupCarouselEvents();
        }
    }, 100);
}

async function recognizeText(img) {
    return Tesseract.recognize(img, 'eng');
}

async function saveToDrive(base64, player) {
    // Usar el código personalizado o fallback a 3 letras del nombre
    const teamCode = player.teamCode || (player.team || "SIN").substring(0, 3).toUpperCase();
    const fileName = `${teamCode}_${player.number}_${player.name.replace(/\s+/g, '_')}.png`;
    const teamName = player.team || "SIN_EQUIPO";

    console.log("Intentando guardar en Drive:", fileName, "para equipo:", teamName);

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        return new Promise((resolve) => {
            google.script.run
                .withSuccessHandler((res) => {
                    console.log("✅ Éxito Drive:", res);
                    resolve(res);
                })
                .withFailureHandler((err) => {
                    console.error("❌ Error GAS Drive:", err);
                    resolve(null);
                })
                .saveProcessedImage(base64, fileName, teamName);
        });
    } else {
        console.warn("Modo Local: Intentando guardar en Drive vía Fetch (no-cors)...");
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ 
                    action: 'saveImage', 
                    image: base64, 
                    fileName: fileName, 
                    teamName: teamName 
                })
            });
            console.log("✅ Petición de guardado enviada (no-cors)");
        } catch (e) {
            console.error("❌ Error en fetch fallback:", e);
        }
    }
}

async function waitForManualCorrection(initialData, detectedNumber, playerImg) {
    const editPanel = document.getElementById('editPanel');
    const editName = document.getElementById('editName');
    const editNumber = document.getElementById('editNumber');
    const editTeam = document.getElementById('editTeam');
    const editCapBtn = document.getElementById('editCapBtn');
    const confirmBtn = document.getElementById('confirmEditBtn');

    // --- CROPPER 1: CARNET ---
    const cropperImg = document.getElementById('cropperImg');
    const cropperBox = document.getElementById('cropperBox');
    const zoomSlider = document.getElementById('cropperZoom');
    cropperImg.src = playerImg.src || playerImg.toDataURL();
    let drag1 = { isDragging: false, startY: 0, startX: 0, currY: -50, currX: -50, zoom: 1 };

    // --- CROPPER 2: PRO HD ---
    const cropperImgHD = document.getElementById('cropperImgHD');
    const cropperBoxHD = document.getElementById('cropperBoxHD');
    const zoomSliderHD = document.getElementById('cropperZoomHD');
    cropperImgHD.src = playerImg.src || playerImg.toDataURL();
    let drag2 = { isDragging: false, startY: 0, startX: 0, currY: -20, currX: -100, zoom: 0.4 };

    const updateUI = (box, drag, img, zoomEl) => {
        box.style.top = drag.currY + "px";
        box.style.left = drag.currX + "px";
        img.style.width = (400 * drag.zoom) + "px";
    };

    updateUI(cropperBox, drag1, cropperImg);
    updateUI(cropperBoxHD, drag2, cropperImgHD);

    zoomSlider.oninput = () => { drag1.zoom = parseFloat(zoomSlider.value); updateUI(cropperBox, drag1, cropperImg); };
    zoomSliderHD.oninput = () => { drag2.zoom = parseFloat(zoomSliderHD.value); updateUI(cropperBoxHD, drag2, cropperImgHD); };

    // Eventos Genéricos de Arrastre
    const setupDrag = (container, dragObj, box, img) => {
        const start = (e) => {
            dragObj.isDragging = true;
            const event = e.touches ? e.touches[0] : e;
            dragObj.startY = event.clientY - dragObj.currY;
            dragObj.startX = event.clientX - dragObj.currX;
        };
        const move = (e) => {
            if (!dragObj.isDragging) return;
            const event = e.touches ? e.touches[0] : e;
            dragObj.currY = event.clientY - dragObj.startY;
            dragObj.currX = event.clientX - dragObj.startX;
            updateUI(box, dragObj, img);
        };
        const stop = () => dragObj.isDragging = false;
        container.addEventListener('mousedown', start);
        container.addEventListener('touchstart', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', stop);
        window.addEventListener('touchend', stop);
    };

    setupDrag(document.getElementById('cropperContainer'), drag1, cropperBox, cropperImg);
    setupDrag(document.getElementById('cropperContainerHD'), drag2, cropperBoxHD, cropperImgHD);

    // Poblar campos iniciales... (resto igual)
    editName.value = initialData.name.replace(" (C)", "");
    editNumber.value = detectedNumber === "??" ? "" : detectedNumber;
    editTeam.value = initialData.team;

    // Setear posición inicial en los botones
    const pos = initialData.position || "DEL";
    document.querySelectorAll('#editPosBtns .pos-btn').forEach(b => {
        b.classList.toggle('active', b.innerText === pos);
    });

    // Setear capitán
    const isCap = initialData.name.includes("(C)");
    editCapBtn.classList.toggle('active', isCap);

    // Lógica Dinámica: Al cambiar el número, buscar en la nómina activa
    const team = allTeams[activeTeamId];
    editNumber.oninput = () => {
        const num = editNumber.value;
        if (team && team.roster[num]) {
            const p = team.roster[num];
            const name = typeof p === 'string' ? p : p.name;
            const pos = typeof p === 'string' ? "DEL" : (p.position || "DEL");
            const cap = typeof p === 'string' ? false : p.isCaptain;

            editName.value = name;
            editCapBtn.classList.toggle('active', cap);
            document.querySelectorAll('#editPosBtns .pos-btn').forEach(b => {
                b.classList.toggle('active', b.innerText === pos);
            });

            editName.style.borderColor = "var(--primary)";
            setTimeout(() => editName.style.borderColor = "", 500);
        }
    };

    // Mostrar panel
    editPanel.classList.remove('hidden');

    return new Promise((resolve) => {
        confirmBtn.onclick = () => {
            const activePosBtn = document.querySelector('#editPosBtns .pos-btn.active');
            const finalPos = activePosBtn ? activePosBtn.innerText : "DEL";
            const finalCap = editCapBtn.classList.contains('active');

            // Calcular geometría CROP 1 (Carnet)
            const s1 = playerImg.width / (400 * drag1.zoom);
            const crop1 = { x: -drag1.currX * s1, y: -drag1.currY * s1, w: 200 * s1, h: 280 * s1 };

            // Calcular geometría CROP 2 (Pro HD)
            const s2 = playerImg.width / (400 * drag2.zoom);
            const crop2 = { x: -drag2.currX * s2, y: -drag2.currY * s2, w: 320 * s2, h: 180 * s2 };

            const updatedData = {
                name: editName.value.toUpperCase() + (finalCap ? " (C)" : ""),
                team: editTeam.value.toUpperCase(),
                number: editNumber.value,
                position: finalPos,
                teamCode: team ? team.code : initialData.teamCode,
                color: initialData.color || "#00ff88",
                color2: initialData.color2 || "#00d4ff",
                shield: initialData.shield
            };

            editPanel.classList.add('hidden');
            resolve({ data: updatedData, crop: crop1, cropHD: crop2 });
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

async function generateLayouts(playerCanvas, player, shouldRemoveBg = true, manualCrop = null, manualCropHD = null) {
    // --- 1. ENCUADRE CARNET (Cara y Hombros) ---
    const carnetCrop = manualCrop || createSmartCrop(playerCanvas, shouldRemoveBg);

    // --- 2. CANVAS DE TRANSMISIÓN (Plano Americano / Manual) ---
    const ctxOut = elements.outputCanvas.getContext('2d');
    elements.outputCanvas.width = CONFIG.outputWidth;
    elements.outputCanvas.height = CONFIG.outputHeight;

    if (shouldRemoveBg) {
        await drawBackground(ctxOut, player.color);
    } else {
        const scale = Math.max(CONFIG.outputWidth / playerCanvas.width, CONFIG.outputHeight / playerCanvas.height);
        const w = playerCanvas.width * scale;
        const h = playerCanvas.height * scale;
        ctxOut.drawImage(playerCanvas, (CONFIG.outputWidth - w) / 2, (CONFIG.outputHeight - h) / 2, w, h);
    }

    // Jugador — escalar para cubrir el ancho de la barra (1720) y alinearlo con el logo (y=90)
    if (manualCropHD) {
        const finalY = 90;
        const finalW = 1720;
        const scale = finalW / manualCropHD.w;
        const finalH = manualCropHD.h * scale;
        const finalX = 100;

        ctxOut.save();
        if (shouldRemoveBg) {
            ctxOut.shadowColor = "rgba(0,0,0,0.6)";
            ctxOut.shadowBlur = 40;
        }
        ctxOut.drawImage(playerCanvas,
            manualCropHD.x, manualCropHD.y, manualCropHD.w, manualCropHD.h,
            finalX, finalY, finalW, finalH
        );
        ctxOut.restore();
    } else if (shouldRemoveBg) {
        const finalW = 1720;
        const scale = finalW / playerCanvas.width;
        const finalH = playerCanvas.height * scale;
        const finalX = 100;
        const finalY = 90;

        ctxOut.save();
        ctxOut.shadowColor = "rgba(0,0,0,0.6)";
        ctxOut.shadowBlur = 30;
        ctxOut.drawImage(playerCanvas, finalX, finalY, finalW, finalH);
        ctxOut.restore();
    }

    /* 
    // COMENTADO: Sombra inferior eliminada por petición de fondo totalmente negro
    const grdShadow = ctxOut.createLinearGradient(0, CONFIG.outputHeight - 300, 0, CONFIG.outputHeight);
    grdShadow.addColorStop(0, "transparent");
    grdShadow.addColorStop(1, "rgba(0,0,0,0.8)");
    ctxOut.fillStyle = grdShadow;
    ctxOut.fillRect(0, CONFIG.outputHeight - 300, CONFIG.outputWidth, 300);
    */

    // --- SOMBRA PERIMETRAL (4 Lados - Estilo Carnet) ---
    drawPerimeterShadow(ctxOut, CONFIG.outputWidth, CONFIG.outputHeight);

    await drawSportsTicker(ctxOut, player);

    // 2.5 LOGO DE LA APP (Arriba Izquierda - Bajado otros 15px de 75 a 90)
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1m2q_HDTJE1aClZFtqAJMoD5bE9cJNMI0?t=0");
        drawImageProp(ctxOut, logoImg, 100, 90, 300, 140, 0, 0);
    } catch (e) { }

    // --- 2.6 INFO DE PARTIDO ---
    if (selectedMatchTeamA && selectedMatchTeamB) {
        await drawMatchInfo(ctxOut, allTeams[selectedMatchTeamA], allTeams[selectedMatchTeamB]);
    }

    // --- 3. CANVAS DE CARNET (Zoom a la Cara) ---
    const ctxCarnet = elements.carnetCanvas.getContext('2d');
    const cw = CONFIG.carnetWidth;
    const ch = CONFIG.carnetHeight;
    elements.carnetCanvas.width = cw;
    elements.carnetCanvas.height = ch;

    // Fondo Carnet con Degradado 45 grados (Si se quita el fondo)
    if (shouldRemoveBg) {
        const grdBg = ctxCarnet.createLinearGradient(0, 0, cw, ch);
        grdBg.addColorStop(0, player.color);
        grdBg.addColorStop(1, player.color2 || player.color);
        ctxCarnet.fillStyle = grdBg;
        ctxCarnet.fillRect(0, 0, cw, ch);

        // Textura sutil
        ctxCarnet.fillStyle = "rgba(0,0,0,0.2)";
        ctxCarnet.fillRect(0, 0, cw, ch);
    } else {
        ctxCarnet.fillStyle = "#111";
        ctxCarnet.fillRect(0, 0, cw, ch);
    }

    // Jugador con Zoom (Smart Crop o Manual)
    if (manualCrop) {
        // Usar coordenadas manuales directamente sobre el canvas original
        ctxCarnet.drawImage(playerCanvas, manualCrop.x, manualCrop.y, manualCrop.w, manualCrop.h, 0, 0, cw, ch);
    } else {
        // Usar el canvas temporal generado por smart crop
        const cScale = cw / carnetCrop.width;
        ctxCarnet.drawImage(carnetCrop, 0, 0, carnetCrop.width, carnetCrop.height, 0, 0, cw, carnetCrop.height * cScale);
    }

    // Barra lateral Degradada (50px)
    const barW = 50;
    const grdSide = ctxCarnet.createLinearGradient(0, 0, 0, ch);
    grdSide.addColorStop(0, player.color);
    grdSide.addColorStop(1, player.color2 || player.color);
    ctxCarnet.fillStyle = grdSide;
    ctxCarnet.fillRect(0, 0, barW, ch);

    await drawCarnetOverlay(ctxCarnet, player);

    // Borde Panini Final
    addPaniniBorder(ctxOut, CONFIG.outputWidth, CONFIG.outputHeight);
    addPaniniBorder(ctxCarnet, cw, ch);
}

function createSmartCrop(playerCanvas, isTransparent = true) {
    const ctx = playerCanvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, playerCanvas.width, playerCanvas.height).data;

    // Encontrar el primer pixel no transparente (Tope de la cabeza)
    let top = 0;
    if (isTransparent) {
        for (let y = 0; y < playerCanvas.height; y++) {
            for (let x = 0; x < playerCanvas.width; x++) {
                if (pixels[(y * playerCanvas.width + x) * 4 + 3] > 10) {
                    top = y;
                    y = playerCanvas.height; break;
                }
            }
        }
    } else {
        // Si no es transparente (fondo original), asumimos que la cabeza está al 10% del tope
        top = playerCanvas.height * 0.1;
    }

    // Definir área de carnet
    const cropHeight = playerCanvas.height * 0.45;
    const cropWidth = cropHeight * (CONFIG.carnetWidth / CONFIG.carnetHeight);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tCtx = tempCanvas.getContext('2d');

    const xOffset = (playerCanvas.width - cropWidth) / 2;
    tCtx.drawImage(playerCanvas, xOffset, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return tempCanvas;
}

async function drawShield(ctx, shieldUrl) {
    try {
        const shieldImg = await loadImg(shieldUrl);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 20;
        ctx.drawImage(shieldImg, 80, 80, 180, 180); // Lado Izquierdo
        ctx.restore();
    } catch (e) {
        console.warn("No se pudo cargar el escudo:", shieldUrl);
    }
}

async function drawCarnetOverlay(ctx, player) {
    const h = CONFIG.carnetHeight;
    const w = CONFIG.carnetWidth;

    // 1. MI LOGO EN EL CARNET (Arriba Izquierda - Más grande)
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1m2q_HDTJE1aClZFtqAJMoD5bE9cJNMI0?t=0");
        drawImageProp(ctx, logoImg, 15, 20, 180, 90, 0, 0);
    } catch (e) { }

    // 2. INFO PARTIDO EN CARNET (Match Day)
    if (selectedMatchTeamA && selectedMatchTeamB) {
        const teamA = allTeams[selectedMatchTeamA];
        const teamB = allTeams[selectedMatchTeamB];
        const stage = document.getElementById('matchStage').value;
        const date = document.getElementById('matchDate').value || "";

        const ms = 60; // Aumentado de 40 a 60
        const totalW = (ms * 2) + 15;
        const startX = w - totalW - 25;
        const my = 20;

        try {
            const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
            drawImageProp(ctx, imgA, startX, my, ms, ms);
            const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
            drawImageProp(ctx, imgB, startX + ms + 15, my, ms, ms);
        } catch (e) { }

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "center";
        const centerX = startX + totalW / 2;
        ctx.font = "900 18px Outfit"; // Aumentado de 12 a 18
        ctx.fillText(stage.toUpperCase(), centerX, my + ms + 25);
        ctx.font = "400 14px Outfit"; // Aumentado de 10 a 14
        ctx.fillText(date, centerX, my + ms + 45);
    }

    // 3. (ELIMINADO NÚMERO GIGANTE)

    // Degradado inferior
    const grd = ctx.createLinearGradient(0, h - 350, 0, h);
    grd.addColorStop(0, "transparent");
    grd.addColorStop(1, "black");
    ctx.fillStyle = grd;
    ctx.fillRect(0, h - 350, w, 350);

    const cleanName = player.name.replace(" (C)", "");
    const nameParts = cleanName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // 4. ESCUDO DEL EQUIPO 
    let textX = 140;
    if (player.shield) {
        try {
            const sImg = await loadImg(player.shield);
            ctx.drawImage(sImg, 10, h - 150, 100, 100);
        } catch (e) { }
    }

    // 5. NOMBRE DEL JUGADOR (Dinamismo para evitar solapamiento)
    const finalX = 130 - 10;
    let firstSize = 28;
    let lastSize = 50;

    // Medir ancho para ajuste dinámico
    ctx.font = `900 ${lastSize}px Outfit`;
    const nameWidth = ctx.measureText(lastName.toUpperCase()).width;
    const limitX = w - 180; // Margen antes del número

    if (finalX + nameWidth > limitX) {
        firstSize *= 0.8;
        lastSize *= 0.8;
    }

    ctx.textAlign = "left";
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `400 ${firstSize}px Outfit`;
    ctx.fillText(firstName, finalX, h - 100);

    ctx.fillStyle = "white";
    ctx.font = `900 ${lastSize}px Outfit`;
    ctx.fillText(lastName.toUpperCase(), finalX, h - 50);

    // 5.1 POSICIÓN (Estilo Tarjeta Pro: Cuadro de color con letras negras)
    if (player.position) {
        ctx.save();
        // Medir ancho del primer nombre para desplazar el badge dinámicamente
        ctx.font = `400 ${firstSize}px Outfit`;
        const firstNameW = ctx.measureText(firstName).width;

        const badgeW = 70;
        const badgeH = 35;
        const bX = finalX + firstNameW + 20; // 20px a la derecha del nombre
        const bY = h - 128; // Ajustado ligeramente el alto para mejor alineación

        // Cuadro de color
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.roundRect(bX, bY, badgeW, badgeH, 5);
        ctx.fill();

        // Texto negro
        ctx.fillStyle = "#000";
        ctx.font = "900 22px Outfit";
        ctx.textAlign = "center";
        ctx.fillText(player.position.toUpperCase(), bX + badgeW/2, bY + 26);
        ctx.restore();
    }

    ctx.restore();

    // 6. NÚMERO CON DEGRADADO (Reducido a 140px)
    ctx.save();
    const grdNum = ctx.createLinearGradient(w - 150, h - 150, w, h - 50);
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };
    grdNum.addColorStop(0, hexToRgba(player.color, 0.6));
    grdNum.addColorStop(1, hexToRgba(player.color2 || player.color, 0.6));

    ctx.fillStyle = grdNum;
    ctx.font = "italic 900 140px Outfit";
    ctx.textAlign = "right";
    ctx.fillText(player.number, w - 30, h - 50);
    ctx.restore();

    // 7. Icono Capitán (C) - Bajado otros 15px y 5px a la derecha
    if (player.name.includes("(C)")) {
        ctx.save();
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        // x previo: w-60+5, y previo: h-220+20
        ctx.arc(w - 60 + 10, h - 220 + 35, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.font = "900 32px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("C", w - 60 + 10, h - 208 + 35);
        ctx.restore();
    }
}


async function drawBackground(ctx, color, color2) {
    // Fondo TOTALMENTE NEGRO sin elementos por petición del usuario
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 1920, 1080);
}

async function drawSportsTicker(ctx, player) {
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

    let currentX = 140;

    // 3. ESCUDO DEL EQUIPO (Sobresaliendo de la barra)
    if (player.shield) {
        try {
            const sImg = await loadImg(player.shield);
            const shieldSize = 140; // Más grande que la barra (120)
            ctx.drawImage(sImg, currentX, bY - 20, shieldSize, shieldSize);
            currentX += shieldSize + 10;
        } catch (e) { }
    }

    // 4. Posición Badge
    if (player.position) {
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.roundRect(currentX, bY + 35, 90, 50, 8);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "900 30px Outfit";
        ctx.textAlign = "center";
        ctx.fillText(player.position, currentX + 45, bY + 72);
        currentX += 110;
    }

    // 5. Nombre y Número (CON SOMBRA AGRESIVA)
    ctx.textAlign = "left";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = "#FFF";
    ctx.font = "900 65px Outfit";
    const displayName = player.name.replace(" (C)", "");
    ctx.fillText(`${player.number} | ${displayName}`, currentX, bY + 82);
    ctx.restore();

    // 5.5 ICONO CAPITÁN (Estilo Carnet - 400px a la derecha)
    if (player.name.includes("(C)")) {
        const nameW = ctx.measureText(`${player.number} | ${displayName}`).width;
        const capX = currentX + nameW + 400; // Movido 400px a la derecha
        ctx.save();
        // Sombra propia para el icono
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        ctx.arc(capX + 24, bY + 58, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.font = "900 32px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("C", capX + 24, bY + 70);
        ctx.restore();
    }

    // 6. Nombre del Equipo (Derecha)
    ctx.textAlign = "right";
    ctx.font = "700 35px Outfit";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(player.team.toUpperCase(), 1780, bY + 75);
}

async function drawMatchInfo(ctx, teamA, teamB) {
    const stage = document.getElementById('matchStage').value;
    const date = document.getElementById('matchDate').value || new Date().toLocaleDateString();

    const sSize = 100;
    const totalW = (sSize * 2) + 20;
    // Alineado con el final de la barra negra (100 + 1720 = 1820)
    const x = 1820 - totalW;
    const y = 90; // Bajado otros 15px (total 90)

    ctx.save();
    ctx.globalAlpha = 1.0;

    if (teamA.shieldWhite || teamA.shield) {
        try {
            const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
            drawImageProp(ctx, imgA, x, y, sSize, sSize);
        } catch (e) { }
    }

    if (teamB.shieldWhite || teamB.shield) {
        try {
            const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
            drawImageProp(ctx, imgB, x + sSize + 20, y, sSize, sSize);
        } catch (e) { }
    }
    ctx.restore();

    // Texto Info CENTRADO respecto a los escudos
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    const centerX = x + totalW / 2;

    ctx.font = "900 30px Outfit";
    ctx.fillText(stage, centerX, y + sSize + 40);

    ctx.font = "400 22px Outfit";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(date, centerX, y + sSize + 70);
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
    const base64 = canvas.toDataURL('image/png');
    link.href = base64;
    link.click();

    // SUBIR A DRIVE AL DESCARGAR
    if (currentPlayerData) {
        console.log("Subiendo copia a Drive por solicitud de descarga...");
        saveToDrive(base64, currentPlayerData);
    }
}

function resetApp() {
    elements.resultArea.classList.add('hidden');
    elements.processingArea.classList.add('hidden');
    document.getElementById('editPanel').classList.add('hidden');
    document.getElementById('postalResultArea').classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    elements.imageInput.value = '';
    // Recargar para limpiar estados de IA si es necesario
    // location.reload(); 
}

function drawPerimeterShadow(ctx, w, h) {
    ctx.save();
    // 1. Degradado Radial masivo para las esquinas
    const grd = ctx.createRadialGradient(w / 2, h / 2, w / 4, w / 2, h / 2, w / 1.1);
    grd.addColorStop(0, "transparent");
    grd.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // 2. Refuerzo en bordes (Linear)
    const edgeSize = 250;

    // Superior
    const grdTop = ctx.createLinearGradient(0, 0, 0, edgeSize);
    grdTop.addColorStop(0, "rgba(0,0,0,0.9)");
    grdTop.addColorStop(1, "transparent");
    ctx.fillStyle = grdTop;
        ctx.fillRect(0, 0, w, edgeSize);

        // Inferior
        const grdBot = ctx.createLinearGradient(0, h, 0, h - edgeSize);
        grdBot.addColorStop(0, "rgba(0,0,0,0.9)");
        grdBot.addColorStop(1, "transparent");
        ctx.fillStyle = grdBot;
        ctx.fillRect(0, h - edgeSize, w, edgeSize);

    ctx.restore();
}

// Borde blanco estilo cromo Panini — se dibuja siempre ÚLTIMO, encima de todo
function addPaniniBorder(ctx, w, h, excludeSides = []) {
    const t = Math.round(Math.min(w, h) * 0.025); // 2.5% del lado menor
    ctx.save();
    ctx.fillStyle = "#ffffff";
    if (!excludeSides.includes('top'))    ctx.fillRect(0, 0, w, t);           // Arriba
    if (!excludeSides.includes('bottom')) ctx.fillRect(0, h - t, w, t);       // Abajo
    if (!excludeSides.includes('left'))   ctx.fillRect(0, 0, t, h);           // Izquierda
    if (!excludeSides.includes('right'))  ctx.fillRect(w - t, 0, t, h);       // Derecha
    ctx.restore();
}

// --- CARRUSEL INSTAGRAM EQUIPO (VERSION PESTAÑA) ---
let carouselState = { img: null, x: 0, y: 0, scale: 1, rotate: 0, isDragging: false, startX: 0, startY: 0 };

// carouselState.baseScale: the "fill container" scale (zoom multiplier = 1.0)
async function initCarouselWithPhoto(img) {
    if (!img) return;

    // Convertir canvas a Image si hace falta (removeBackground retorna un canvas)
    let imgEl;
    if (img instanceof HTMLCanvasElement) {
        imgEl = new Image();
        imgEl.src = img.toDataURL('image/png');
        await new Promise(r => imgEl.onload = r);
    } else {
        imgEl = img;
    }
    carouselState.img = imgEl;

    const viewImg = document.getElementById('tabCarouselImg');
    if (viewImg) viewImg.src = imgEl.src;

    const preview = document.getElementById('tabCarouselPreview');
    if (preview) preview.classList.add('hidden');

    // Esperar hasta que el tab sea visible para calcular dimensiones correctas
    setTimeout(() => {
        resetCarouselPosition();
        setupCarouselEvents();
    }, 200);
}

function setupCarouselEvents() {
    const container = document.getElementById('tabCarouselContainer');
    if (!container) return;

    const start = (e) => {
        carouselState.isDragging = true;
        const pos = e.touches ? e.touches[0] : e;
        carouselState.startX = pos.clientX - carouselState.x;
        carouselState.startY = pos.clientY - carouselState.y;
    };

    const move = (e) => {
        if (!carouselState.isDragging) return;
        const pos = e.touches ? e.touches[0] : e;
        carouselState.x = pos.clientX - carouselState.startX;
        carouselState.y = pos.clientY - carouselState.startY;
        updateCarouselImg();
    };

    const stop = () => carouselState.isDragging = false;

    container.addEventListener('mousedown', start);
    container.addEventListener('touchstart', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);

    const zoom = document.getElementById('tabCarouselZoom');
    if (zoom) zoom.oninput = (e) => {
        const multiplier = parseFloat(e.target.value);
        const newScale = carouselState.baseScale * multiplier;
        const cW = container.clientWidth, cH = container.clientHeight;
        const relX = (cW / 2 - carouselState.x) / carouselState.scale;
        const relY = (cH / 2 - carouselState.y) / carouselState.scale;
        carouselState.scale = newScale;
        carouselState.x = cW / 2 - relX * newScale;
        carouselState.y = cH / 2 - relY * newScale;
        updateCarouselImg();
    };
    const rotate = document.getElementById('tabCarouselRotate');
    if (rotate) rotate.oninput = (e) => {
        carouselState.rotate = parseInt(e.target.value);
        updateCarouselImg();
    };
}

function resetCarouselPosition() {
    if (!carouselState.img) return;
    const container = document.getElementById('tabCarouselContainer');
    if (!container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    // baseScale = scale that fills the container (cover)
    carouselState.baseScale = Math.max(cW / carouselState.img.width, cH / carouselState.img.height);
    carouselState.scale = carouselState.baseScale;
    carouselState.x = (cW - carouselState.img.width * carouselState.scale) / 2;
    carouselState.y = (cH - carouselState.img.height * carouselState.scale) / 2;
    carouselState.rotate = 0;
    // Slider midpoint = 1.0 = fill container
    const zoom = document.getElementById('tabCarouselZoom');
    if (zoom) zoom.value = 1.0;
    const rot = document.getElementById('tabCarouselRotate');
    if (rot) rot.value = 0;
    updateCarouselImg();
}

function updateCarouselImg() {
    const img = document.getElementById('tabCarouselImg');
    if (!img || !carouselState.img) return;
    img.style.width = (carouselState.img.width * carouselState.scale) + 'px';
    img.style.transform = `translate(${carouselState.x}px, ${carouselState.y}px) rotate(${carouselState.rotate}deg)`;
}

async function confirmCarouselFraming() {
    if (!carouselState.img) return;

    const container = document.getElementById('tabCarouselContainer');
    const cW = container.clientWidth;
    const cH = container.clientHeight;

    const canvas1 = document.getElementById('tabCarouselCanvas1');
    const canvas2 = document.getElementById('tabCarouselCanvas2');
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');

    const size = 1080;
    canvas1.width = size; canvas1.height = size;
    canvas2.width = size; canvas2.height = size;

    // The container represents 2 panels side by side (total width = 2*size output)
    // Use WIDTH as the reference so the panorama splits correctly at center
    const renderScale = (size * 2) / cW;
    const realW = carouselState.img.width  * carouselState.scale * renderScale;
    const realH = carouselState.img.height * carouselState.scale * renderScale;
    const realX = carouselState.x * renderScale;
    const realY = carouselState.y * renderScale;

    [ctx1, ctx2].forEach((ctx, i) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        ctx.save();
        ctx.translate(realX - (i * size) + realW / 2, realY + realH / 2);
        ctx.rotate(carouselState.rotate * Math.PI / 180);
        ctx.drawImage(carouselState.img, -realW / 2, -realH / 2, realW, realH);
        ctx.restore();
        drawPerimeterShadow(ctx, size, size);
    });

    // Logo en Slide 1
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1m2q_HDTJE1aClZFtqAJMoD5bE9cJNMI0?t=0");
        drawImageProp(ctx1, logoImg, 80, 80, 300, 140);
    } catch (e) {}

    // Info partido en Slide 2
    if (selectedMatchTeamA && selectedMatchTeamB) {
        const teamA = allTeams[selectedMatchTeamA];
        const teamB = allTeams[selectedMatchTeamB];
        const stage = (document.getElementById('matchStage') || {}).value || '';
        const date = (document.getElementById('matchDate') || {}).value || '';
        const sSize = 100;
        const totalW2 = (sSize * 2) + 20;
        const x2 = size - totalW2 - 80;
        const y2 = 80;
        try {
            const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
            drawImageProp(ctx2, imgA, x2, y2, sSize, sSize);
            const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
            drawImageProp(ctx2, imgB, x2 + sSize + 20, y2, sSize, sSize);
        } catch (e) {}
        ctx2.save();
        ctx2.shadowColor = "black"; ctx2.shadowBlur = 20;
        ctx2.fillStyle = "white";
        ctx2.textAlign = "center";
        ctx2.font = "900 35px Outfit";
        ctx2.fillText(stage.toUpperCase(), x2 + totalW2 / 2, y2 + sSize + 40);
        ctx2.font = "400 25px Outfit";
        ctx2.fillStyle = "rgba(255,255,255,0.8)";
        ctx2.fillText(date, x2 + totalW2 / 2, y2 + sSize + 75);
        ctx2.restore();
    }

    // Ticker: use activeTeamId (player's team) with fallback to match team
    const tickerTeamId = activeTeamId || selectedMatchTeamA;
    const tickerTeam = tickerTeamId ? allTeams[tickerTeamId] : null;
    if (tickerTeam) {
        const barW = 1200;
        const barH = 150;
        const bX_total = (size * 2) / 2 - barW / 2;
        const bY = size - 240;

        const drawTickerOn = async (ctx, offsetX) => {
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 25;
            ctx.fillStyle = "rgba(0,0,0,0.92)";
            const relX = bX_total - offsetX;
            ctx.beginPath();
            ctx.roundRect(relX, bY, barW, barH, 25);
            ctx.fill();
            ctx.fillStyle = tickerTeam.color1 || tickerTeam.color || "#00ff88";
            ctx.fillRect(relX, bY, 15, barH);
            if (tickerTeam.shield) {
                try {
                    const sImg = await loadImg(tickerTeam.shield);
                    ctx.drawImage(sImg, relX + 60, bY - 35, 200, 200);
                } catch (e) {}
            }
            ctx.fillStyle = "white";
            ctx.textAlign = "left";
            ctx.font = "900 60px Outfit";
            ctx.fillText(tickerTeam.name.toUpperCase(), relX + 280, bY + 95);
            ctx.restore();
        };

        await drawTickerOn(ctx1, 0);
        await drawTickerOn(ctx2, size);
    }

    // Borde Panini Final (Unión perfecta para carrusel)
    addPaniniBorder(ctx1, size, size, ['right']);
    addPaniniBorder(ctx2, size, size, ['left']);

    document.getElementById('tabCarouselPreview').classList.remove('hidden');
}

function downloadCarousel() {
    downloadImage('carouselCanvas1', 'team_slide_1');
    setTimeout(() => downloadImage('carouselCanvas2', 'team_slide_2'), 600);
}

// --- GALERÍA DE ESCUDOS (DRIVE) ---

function openShieldGallery(type = 'main') {
    currentShieldType = type;
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
        if (currentShieldType === 'white') {
            document.getElementById('teamEditor')._selectedShieldWhite = base64;
            document.getElementById('shieldWhitePreview').src = base64;
        } else {
            document.getElementById('teamEditor')._selectedShield = base64;
            document.getElementById('shieldPreview').src = base64;
        }

        alert("Escudo seleccionado ✅");
        closeShieldGallery();
    } catch (e) {
        if (currentShieldType === 'white') {
            document.getElementById('teamEditor')._selectedShieldWhite = highResUrl;
            document.getElementById('shieldWhitePreview').src = highResUrl;
        } else {
            document.getElementById('teamEditor')._selectedShield = highResUrl;
            document.getElementById('shieldPreview').src = highResUrl;
        }
        alert("Escudo vinculado (URL) ✅");
        closeShieldGallery();
    }
}

async function previewLocalShield(input, type = 'main') {
    if (input.files && input.files[0]) {
        const base64 = await imageToBase64(input.files[0]);
        if (type === 'white') {
            document.getElementById('teamEditor')._selectedShieldWhite = base64;
            document.getElementById('shieldWhitePreview').src = base64;
        } else {
            document.getElementById('teamEditor')._selectedShield = base64;
            document.getElementById('shieldPreview').src = base64;
        }
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
// --- SELECTOR VISUAL DE PARTIDO ---
let selectedMatchTeamA = localStorage.getItem('sportshub_match_a') || null;
let selectedMatchTeamB = localStorage.getItem('sportshub_match_b') || null;
let currentPickerSlot = null;

// Inicializar preview y valores guardados
function initMatchSettings() {
    const stage = localStorage.getItem('sportshub_match_stage') || "FASE DE GRUPOS";
    const date = localStorage.getItem('sportshub_match_date') || new Date().toLocaleDateString();

    document.getElementById('matchStage').value = stage;
    document.getElementById('matchDate').value = date;

    if (selectedMatchTeamA && allTeams[selectedMatchTeamA]) {
        const img = document.getElementById('imgA');
        img.src = allTeams[selectedMatchTeamA].shield;
        img.classList.remove('hidden');
        document.querySelector('#slotA .placeholder').classList.add('hidden');
    }
    if (selectedMatchTeamB && allTeams[selectedMatchTeamB]) {
        const img = document.getElementById('imgB');
        img.src = allTeams[selectedMatchTeamB].shield;
        img.classList.remove('hidden');
        document.querySelector('#slotB .placeholder').classList.add('hidden');
    }

    updateMatchPreview();

    // Listeners para auto-guardado
    document.getElementById('matchStage').addEventListener('change', saveMatchSettings);
    document.getElementById('matchDate').addEventListener('input', saveMatchSettings);
}

function saveMatchSettings() {
    localStorage.setItem('sportshub_match_a', selectedMatchTeamA || "");
    localStorage.setItem('sportshub_match_b', selectedMatchTeamB || "");
    localStorage.setItem('sportshub_match_stage', document.getElementById('matchStage').value);
    localStorage.setItem('sportshub_match_date', document.getElementById('matchDate').value);
    updateMatchPreview();
}

function updateMatchPreview() {
    const preview = document.getElementById('matchPreview');
    if (!selectedMatchTeamA || !selectedMatchTeamB) {
        preview.innerHTML = '<span class="preview-text">⚠️ Configura el partido</span>';
        return;
    }

    const teamA = allTeams[selectedMatchTeamA];
    const teamB = allTeams[selectedMatchTeamB];
    const stage = document.getElementById('matchStage').value;

    // Usar escudos blancos si existen para el preview
    const sA = teamA.shieldWhite || teamA.shield;
    const sB = teamB.shieldWhite || teamB.shield;

    preview.innerHTML = `
        <div class="preview-text">
            <img src="${sA}" class="preview-shield">
            <span>VS</span>
            <img src="${sB}" class="preview-shield">
            <span style="margin-left:5px; opacity:0.6; font-size:0.65rem; color:var(--primary)">| ${stage}</span>
        </div>
    `;
}

function openMatchShieldPicker(slot) {
    currentPickerSlot = slot;
    const modal = document.getElementById('matchShieldPickerModal');
    const grid = document.getElementById('matchShieldGrid');
    modal.classList.remove('hidden');

    grid.innerHTML = '';
    Object.entries(allTeams).forEach(([id, team]) => {
        const item = document.createElement('div');
        item.className = 'shield-item-mini';
        item.onclick = () => selectMatchTeam(id);
        item.innerHTML = `
            <img src="${team.shield || 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png'}">
            <p>${team.name}</p>
        `;
        grid.appendChild(item);
    });
}

function closeMatchShieldPicker() {
    document.getElementById('matchShieldPickerModal').classList.add('hidden');
}

function selectMatchTeam(id) {
    const team = allTeams[id];
    if (currentPickerSlot === 'A') {
        selectedMatchTeamA = id;
        const img = document.getElementById('imgA');
        img.src = team.shield;
        img.classList.remove('hidden');
        document.querySelector('#slotA .placeholder').classList.add('hidden');
    } else {
        selectedMatchTeamB = id;
        const img = document.getElementById('imgB');
        img.src = team.shield;
        img.classList.remove('hidden');
        document.querySelector('#slotB .placeholder').classList.add('hidden');
    }
    saveMatchSettings();
    closeMatchShieldPicker();
}
function toggleMatchModal() {
    const modal = document.getElementById('matchDataModal');
    modal.classList.toggle('hidden');
}
// --- HELPERS GRÁFICOS ---
function drawImageProp(ctx, img, x, y, w, h, offsetX = 0.5, offsetY = 0.5) {
    const iw = img.width, ih = img.height;
    const r = Math.min(w / iw, h / ih);
    let nw = iw * r, nh = ih * r;
    let cx, cy, cw, ch, ar = 1;

    // contain
    cx = (w - nw) * offsetX;
    cy = (h - nh) * offsetY;
    ctx.drawImage(img, x + cx, y + cy, nw, nh);
}

function loadImg(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (url.startsWith('http')) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Error loading image: " + url));
        img.src = url;
    });
}

initMatchSettings();

// --- VINCULACIÓN DE BOTONES (MODO ROBUSTO) ---
document.addEventListener('DOMContentLoaded', () => {
    const btnSync = document.getElementById('btnSyncCloud');
    if (btnSync) {
        btnSync.addEventListener('click', () => {
            if (confirm("⚠️ ¿Sincronizar desde la nube?\nSe borrarán tus equipos locales y se bajarán los de Drive. ¿Continuar?")) {
                syncWithCloud();
            }
        });
    }

    const btnUpload = document.getElementById('btnUploadCloud');
    if (btnUpload) {
        btnUpload.addEventListener('click', uploadToCloud);
    }
});

async function uploadToCloud() {
    const btn = document.getElementById('btnUploadCloud');
    if (!btn) return;
    const originalText = btn.innerHTML;
    
    if (Object.keys(allTeams).length === 0) {
        return alert("No hay equipos locales para subir.");
    }

    if (!confirm("📤 ¿Subir equipos a la nube?\nEsto actualizará la base de datos de Drive con tus equipos actuales.")) return;

    btn.innerHTML = "SUBIENDO... ⏳";
    btn.disabled = true;

    try {
        let result;
        if (typeof google !== 'undefined' && google.script && google.script.run) {
            result = await new Promise((resolve, reject) => {
                google.script.run
                    .withSuccessHandler(res => resolve(res))
                    .withFailureHandler(err => reject(err))
                    .saveAllTeamsData(allTeams);
            });
        } else {
            // Modo Web App Externa: Usamos no-cors para evitar bloqueos del navegador
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'saveAllTeams', data: allTeams })
            });
            result = { success: true }; // En no-cors no podemos leer la respuesta, asumimos éxito
        }

        if (result && result.success) {
            alert("¡Datos guardados en la nube con éxito! ☁️✅");
        } else {
            throw new Error(result ? result.error : "Error desconocido");
        }
    } catch (e) {
        console.error(e);
        alert("Fallo al subir: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function openImportModal() {
    document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

function processBulkImport() {
    const text = document.getElementById('importTextArea').value.trim();
    if (!text) return alert("Pega algún texto primero.");

    const lines = text.split('\n');
    let teamsCreated = {}; // { teamName: { id, name, code, roster: {} } }
    let countTeams = 0;

    lines.forEach(line => {
        if (!line.trim()) return;

        // Detectar formato:
        // 1. Legacy: "Equipo: Jugador 1, Jugador 2..."
        // 2. CSV/Excel: "Equipo, Numero, Nombre, Posicion" (o con Tabs/Punto y coma)
        
        if (line.includes(':') && !line.includes(',') && !line.includes('\t')) {
            // FORMATO LEGACY
            const parts = line.split(':');
            const teamName = parts[0].trim();
            const playersStr = parts.slice(1).join(':').trim();
            
            if (!teamsCreated[teamName]) {
                const teamId = "team_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                teamsCreated[teamName] = {
                    id: teamId,
                    name: teamName,
                    code: teamName.substring(0, 3).toUpperCase(),
                    shield: 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png',
                    color1: '#00ff88',
                    color2: '#00d4ff',
                    roster: {}
                };
                countTeams++;
            }

            playersStr.split(',').forEach((p, index) => {
                const name = p.trim();
                if (name) {
                    const num = (index + 1).toString();
                    teamsCreated[teamName].roster[num] = {
                        name: name.toUpperCase(),
                        position: "DEL",
                        isCaptain: false
                    };
                }
            });
        } else {
            // FORMATO EXCEL / CSV (Separado por , ; o TAB)
            const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
            const parts = line.split(sep).map(s => s.trim());
            
            if (parts.length < 3) return; // Necesitamos al menos Equipo, Numero, Nombre

            // Asumimos orden: Equipo, Numero, Nombre, Posicion
            const teamName = parts[0];
            const playerNum = parts[1];
            const playerName = parts[2];
            const playerPos = parts[3] || "DEL";

            // Saltar cabeceras si existen
            if (playerNum.toLowerCase() === 'numero' || playerName.toLowerCase() === 'nombre') return;

            if (!teamsCreated[teamName]) {
                const teamId = "team_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                teamsCreated[teamName] = {
                    id: teamId,
                    name: teamName,
                    code: teamName.substring(0, 3).toUpperCase(),
                    shield: 'https://cdn-icons-png.flaticon.com/512/5351/5351333.png',
                    color1: '#00ff88',
                    color2: '#00d4ff',
                    roster: {}
                };
                countTeams++;
            }

            if (playerNum && playerName) {
                teamsCreated[teamName].roster[playerNum] = {
                    name: playerName.toUpperCase(),
                    position: playerPos.toUpperCase().substring(0, 3),
                    isCaptain: false
                };
            }
        }
    });

    if (countTeams > 0) {
        // Integrar con los equipos existentes
        Object.assign(allTeams, teamsCreated);
        localStorage.setItem('sportshub_all_teams', JSON.stringify(allTeams));
        renderTeamsList();
        closeImportModal();
        alert("✅ Se han procesado " + countTeams + " equipos nuevos o actualizados.");
    } else {
        alert("No se reconoció el formato.\n\nUsa:\n1. Equipo, Numero, Nombre, Posicion\n2. Equipo: Jugador 1, Jugador 2");
    }
}
function showResultTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const tab = document.getElementById(tabId + 'Tab');
    if (tab) tab.classList.remove('hidden');
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

async function generateMatchPostals() {
    try {
        if (!lastProcessedPlayerImg) {
            return alert("No hay una foto procesada. Por favor, procesa un jugador primero.");
        }

        const getVal = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };

        const word = getVal('postalWord', 'FIN DEL PARTIDO').toUpperCase();
        const score = getVal('postalScore', '0-0');
        const stage = getVal('matchStage', 'PARTIDO');
        const date = getVal('matchDate', '');
        
        // Controles de usuario (Defensivo)
        const gScale = parseFloat(getVal('postalScale', 1)) || 1;
        const gY = parseInt(getVal('postalY', 0)) || 0;
        const gX = parseInt(getVal('postalX', 0)) || 0;

        const teamA = allTeams[selectedMatchTeamA];
        const teamB = allTeams[selectedMatchTeamB];

        const generateOne = async (canvasId, width, height) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            canvas.width = width;
            canvas.height = height;
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // 1. Fondo y Jugador
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, width, height);

            const crop = lastProcessedCropHD;
            if (crop && lastProcessedPlayerImg) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = crop.w;
                tempCanvas.height = crop.h;
                const tCtx = tempCanvas.getContext('2d');
                tCtx.drawImage(lastProcessedPlayerImg, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
                
                const scale = Math.max(width / crop.w, height / crop.h);
                const w = crop.w * scale;
                const h = crop.h * scale;
                ctx.drawImage(tempCanvas, (width - w) / 2, (height - h) / 2, w, h);
            }

            drawPerimeterShadow(ctx, width, height);
            ctx.fillStyle = "rgba(0,0,0,0.5)"; 
            ctx.fillRect(0, 0, width, height);

            // 2. TEXTO Y ASSETS
            ctx.save();
            ctx.translate(gX, gY); 
            
            ctx.textAlign = "center";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 20;

            const centerY = height / 2;

            // A. Palabra Principal
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.font = `italic 900 ${120 * gScale}px Outfit`;
            ctx.fillText(word, width / 2, centerY - (280 * gScale));

            // B. ESCUDOS
            if (teamA && teamB) {
                const sSize = 250 * gScale; 
                const totalShieldsW = (sSize * 2) + (100 * gScale);
                const startX = (width - totalShieldsW) / 2;
                const sY = centerY - (200 * gScale);

                try {
                    const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
                    drawImageProp(ctx, imgA, startX, sY, sSize, sSize);
                    const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
                    drawImageProp(ctx, imgB, startX + sSize + (100 * gScale), sY, sSize, sSize);
                } catch (e) {}

                // C. STAGE Y FECHA
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.font = `italic 400 ${45 * gScale}px Outfit`;
                ctx.fillText(`${stage} • ${date}`, width / 2, sY + sSize + (80 * gScale));
            }

            // D. MARCADOR
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.font = `italic 900 ${280 * gScale}px Outfit`;
            ctx.fillText(score, width / 2, centerY + (380 * gScale));
            ctx.restore();

            // E. Logo
            try {
                const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1m2q_HDTJE1aClZFtqAJMoD5bE9cJNMI0?t=0");
                ctx.globalAlpha = 0.6;
                drawImageProp(ctx, logoImg, 60, 60, 250, 100, 0, 0); 
                ctx.globalAlpha = 1.0;
            } catch (e) {}

            // Borde Panini
            addPaniniBorder(ctx, width, height);
        };

        await generateOne('postalCanvasH', 1920, 1080);
        await generateOne('postalCanvasV', 1080, 1920);

        const resArea = document.getElementById('postalResultArea');
        if (resArea) resArea.classList.remove('hidden');

    } catch (e) {
        console.error("Error en generateMatchPostals:", e);
    }
}

async function generateArteLayouts(playerImg, data, crop) {
    if (!playerImg) return;
    
    // Convertir a elemento Image si es canvas
    let imgEl = playerImg;
    if (playerImg instanceof HTMLCanvasElement) {
        imgEl = new Image();
        imgEl.src = playerImg.toDataURL('image/png');
        await new Promise(r => imgEl.onload = r);
    }

    // Cargar madera si no está
    const woodUrl = "https://drive.google.com/uc?export=view&id=11DBLJqtGBSjNq5ZU1ONWr_PXV9crwuqv";
    let wood;
    try { wood = await loadImg(woodUrl); } catch(e) {}

    // Inicializar estados
    arteStateSq = { ...arteStateSq, img: imgEl, woodImg: wood, data: data, tilt: (Math.random() * 10 - 5) * Math.PI / 180 };
    arteStateVer = { ...arteStateVer, img: imgEl, woodImg: wood, data: data, tilt: (Math.random() * 10 - 5) * Math.PI / 180 };

    resetArtePosition('Sq');
    resetArtePosition('Ver');
    
    setupArteEvents();
    
    updateArtePreview('Sq');
    updateArtePreview('Ver');
}

function resetArtePosition(type) {
    const state = type === 'Sq' ? arteStateSq : arteStateVer;
    if (!state.img) return;
    
    const width = 1080;
    const height = type === 'Sq' ? 1080 : 1920;
    const photoH = height * 0.8;
    
    // Escala inicial para cubrir el área de la foto
    state.scale = Math.max(width / state.img.width, photoH / state.img.height) * 1.1;
    state.x = 0;
    state.y = 0;
    state.rotate = 0;

    // Reset sliders
    const zoomSl = document.getElementById('arteZoom' + type);
    const rotSl = document.getElementById('arteRotate' + type);
    if (zoomSl) zoomSl.value = 1;
    if (rotSl) rotSl.value = 0;
}

async function updateArtePreview(type) {
    const state = type === 'Sq' ? arteStateSq : arteStateVer;
    const canvas = document.getElementById(type === 'Sq' ? 'arteCanvasSquare' : 'arteCanvasVertical');
    if (!canvas || !state.img) return;

    const ctx = canvas.getContext('2d');
    const width = 1080;
    const height = type === 'Sq' ? 1080 : 1920;
    const polaroidH = Math.round(height * 0.20);
    const photoH = height - polaroidH;

    // 1. Crear Polaroid en canvas temporal
    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    const tCtx = temp.getContext('2d');

    // Fondo Foto (Degradado Equipo)
    const pTeam = Object.values(allTeams).find(t => t.name === state.data.team) || {};
    const c1 = pTeam.color1 || state.data.color || "#00ff88";
    const c2 = pTeam.color2 || state.data.color2 || "#00d4ff";
    const grd = tCtx.createLinearGradient(0, 0, width, photoH);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    tCtx.fillStyle = grd;
    tCtx.fillRect(0, 0, width, photoH);

    // Dibujar Jugador con su estado (Zoom, Rotación, Posición)
    const zoomVal = parseFloat(document.getElementById('arteZoom' + type).value || 1);
    const rotVal = parseFloat(document.getElementById('arteRotate' + type).value || 0);
    
    const finalScale = state.scale * zoomVal;
    const drawW = state.img.width * finalScale;
    const drawH = state.img.height * finalScale;

    tCtx.save();
    // Clip para no pintar fuera del área de la foto
    tCtx.beginPath();
    tCtx.rect(0, 0, width, photoH);
    tCtx.clip();

    tCtx.translate(width / 2 + state.x, (photoH / 2) + state.y);
    tCtx.rotate(rotVal * Math.PI / 180);
    tCtx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
    tCtx.restore();

    // Viñeta y Franja Blanca
    drawPerimeterShadow(tCtx, width, photoH);
    tCtx.fillStyle = "#ffffff";
    tCtx.fillRect(0, photoH, width, polaroidH);

    // 1.5 Logo en la Foto (Arriba a la Izquierda)
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1m2q_HDTJE1aClZFtqAJMoD5bE9cJNMI0?t=0");
        const padLogo = Math.round(width * 0.04);
        const logoMaxW = width * 0.25;
        const logoMaxH = photoH * 0.15;
        const scaleL = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height);
        tCtx.globalAlpha = 0.9;
        tCtx.drawImage(logoImg, padLogo, padLogo, logoImg.width * scaleL, logoImg.height * scaleL);
        tCtx.globalAlpha = 1.0;
    } catch(e) {}

    // Contenido inferior
    const teamA = selectedMatchTeamA ? allTeams[selectedMatchTeamA] : null;
    const teamB = selectedMatchTeamB ? allTeams[selectedMatchTeamB] : null;
    const isBW = document.getElementById('polaroidShieldBWToggle')?.checked;
    
    // Mensaje Manuscrito (Izquierda)
    const rawMsg = document.getElementById('polaroidMessage')?.value;
    const msg = rawMsg && rawMsg.trim() !== '' ? rawMsg : 'Memorias.....';
    const pad = Math.round(width * 0.04);
    
    tCtx.save();
    tCtx.textAlign = "left";
    tCtx.fillStyle = "#222";
    tCtx.font = `${Math.round(polaroidH * 0.30)}px Caveat`;
    // Centrado verticalmente con el bloque de escudos y textos de la derecha
    tCtx.fillText(msg, pad, photoH + (polaroidH * 0.55));
    tCtx.restore();

    // Matchday (Derecha: Escudos -> Etapa -> Fecha)
    const stage = (document.getElementById('matchStage') || {}).value || 'PARTIDO';
    const date = (document.getElementById('matchDate') || {}).value || '';
    
    const sSz = Math.round(polaroidH * 0.38); // Escudos más pequeños para que quepa el texto
    const spacing = Math.round(width * 0.015);
    const vsW = Math.round(width * 0.06);
    
    // 1. Calcular ancho total de los escudos
    let shieldsW = 0;
    if (teamA) shieldsW += sSz;
    if (teamA && teamB) shieldsW += spacing + vsW + spacing;
    if (teamB) shieldsW += sSz;
    
    let nextX = width - pad - shieldsW;
    const sY = photoH + (polaroidH * 0.15); // Empezar más arriba

    // Dibujar Escudo A
    if (teamA) { 
        try { 
            const sImg = await loadImg(teamA.shieldWhite || teamA.shield);
            const sScale = Math.min(sSz / sImg.width, sSz / sImg.height);
            const sW = sImg.width * sScale;
            const sH = sImg.height * sScale;
            if (isBW) tCtx.filter = 'grayscale(1) invert(1)';
            tCtx.drawImage(sImg, nextX + (sSz - sW)/2, sY + (sSz - sH)/2, sW, sH);
            tCtx.filter = 'none';
        } catch(e){} 
        nextX += sSz;
    }

    // Dibujar VS
    if (teamA && teamB) {
        nextX += spacing;
        tCtx.fillStyle = isBW ? "#444" : "#aaa";
        tCtx.font = `700 ${Math.round(polaroidH * 0.15)}px Outfit`;
        tCtx.textAlign = "center";
        tCtx.fillText("VS", nextX + (vsW/2), sY + (sSz/2) + (polaroidH*0.05));
        nextX += vsW + spacing;
    }

    // Dibujar Escudo B
    if (teamB) { 
        try { 
            const sImg = await loadImg(teamB.shieldWhite || teamB.shield);
            const sScale = Math.min(sSz / sImg.width, sSz / sImg.height);
            const sW = sImg.width * sScale;
            const sH = sImg.height * sScale;
            if (isBW) tCtx.filter = 'grayscale(1) invert(1)';
            tCtx.drawImage(sImg, nextX + (sSz - sW)/2, sY + (sSz - sH)/2, sW, sH);
            tCtx.filter = 'none';
        } catch(e){} 
    }

    // Textos debajo de los escudos (Centrados con respecto al grupo de escudos)
    const textY = sY + sSz + (polaroidH * 0.15);
    const groupCenterX = width - pad - (shieldsW / 2);
    
    tCtx.textAlign = "center";
    tCtx.fillStyle = "#111";
    tCtx.font = `900 ${Math.round(polaroidH * 0.14)}px Outfit`;
    tCtx.fillText(stage.toUpperCase(), groupCenterX, textY);
    
    tCtx.fillStyle = "#666";
    tCtx.font = `400 ${Math.round(polaroidH * 0.12)}px Outfit`;
    tCtx.fillText(date, groupCenterX, textY + (polaroidH * 0.12));

    addPaniniBorder(tCtx, width, height);

    // 2. Renderizar en Canvas Final con Madera y Rotación
    const applyTilt = document.getElementById('polaroidTiltToggle')?.checked;
    const tilt = applyTilt ? (state.tilt || 0) : 0;
    const absTilt = Math.abs(tilt);
    const finalW = width + (height * Math.sin(absTilt)) + 150;
    const finalH = height + (width * Math.sin(absTilt)) + 150;
    canvas.width = finalW;
    canvas.height = finalH;

    if (state.woodImg) {
        drawImageProp(ctx, state.woodImg, 0, 0, finalW, finalH);
        
        // Degradado lineal con colores del equipo encima del fondo
        const pTeam = Object.values(allTeams).find(t => t.name === state.data.team) || {};
        const c1 = pTeam.color1 || state.data.color || "#00ff88";
        const c2 = pTeam.color2 || state.data.color2 || "#00d4ff";
        
        const bgGrd = ctx.createLinearGradient(0, 0, finalW, finalH);
        bgGrd.addColorStop(0, c1);
        bgGrd.addColorStop(1, c2);
        ctx.fillStyle = bgGrd;
        ctx.globalAlpha = 0.85; // Opacidad para mezclar degradado con la textura de fondo
        ctx.fillRect(0, 0, finalW, finalH);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, finalW, finalH);
    }

    ctx.save();
    ctx.translate(finalW / 2, finalH / 2);
    ctx.rotate(tilt);
    ctx.translate(-width / 2, -height / 2);

    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 15;

    ctx.drawImage(temp, 0, 0);
    ctx.restore();
}

function setupArteEvents() {
    ['Sq', 'Ver'].forEach(type => {
        const canvas = document.getElementById(type === 'Sq' ? 'arteCanvasSquare' : 'arteCanvasVertical');
        const state = type === 'Sq' ? arteStateSq : arteStateVer;
        if (!canvas) return;

        const startMove = (e) => {
            state.isDragging = true;
            const pos = e.touches ? e.touches[0] : e;
            state.startX = pos.clientX - state.x;
            state.startY = pos.clientY - state.y;
        };

        const move = (e) => {
            if (!state.isDragging) return;
            e.preventDefault();
            const pos = e.touches ? e.touches[0] : e;
            state.x = pos.clientX - state.startX;
            state.y = pos.clientY - state.startY;
            updateArtePreview(type);
        };

        const endMove = () => state.isDragging = false;

        canvas.addEventListener('mousedown', startMove);
        canvas.addEventListener('touchstart', startMove);
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('mouseup', endMove);
        window.addEventListener('touchend', endMove);
    });
}


