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
                <option value="POR" ${pos==='POR'?'selected':''}>POR</option>
                <option value="DEF" ${pos==='DEF'?'selected':''}>DEF</option>
                <option value="VOL" ${pos==='VOL'?'selected':''}>VOL</option>
                <option value="DEL" ${pos==='DEL'?'selected':''}>DEL</option>
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
        code: document.getElementById('teamCodeInput').value.toUpperCase().substring(0,3) || teamName.substring(0,3).toUpperCase(),
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
    
    // 1. Mostrar preview inmediato
    const ctx = elements.inputCanvas.getContext('2d');
    elements.inputCanvas.width = img.width;
    elements.inputCanvas.height = img.height;
    ctx.drawImage(img, 0, 0);

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
    
    // 3. Composición de Layout
    updateStep(3, "Creando arte HD...");
    await generateLayouts(finalPlayerImg, finalData.data, shouldRemoveBg, finalData.crop, finalData.cropHD);
        
        // 4. Guardado Automático en Drive
        updateStep(3, "Subiendo a Drive...");
        await saveToDrive(elements.outputCanvas.toDataURL('image/png'), finalData.data);
        
        updateStep(3, "Listo para descargar");
        
        // 5. Mostrar Resultados
        setTimeout(() => {
            elements.processingArea.classList.add('hidden');
            elements.resultArea.classList.remove('hidden');
        }, 500);

    } catch (error) {
        console.error("Error en procesamiento:", error);
        alert("Ocurrió un error al analizar la foto. Intentaremos continuar manualmente.");
        const fallbackData = { name: "ERROR IA", team: "DESCONOCIDO", number: "??", position: "DEL", teamCode: "DFT", color: "#777", color2: "#777" };
        const corrected = await waitForManualCorrection(fallbackData, "??", originalImg);
        await generateLayouts(originalImg, corrected.data, false, corrected.crop, corrected.cropHD);
        
        // También guardar en Drive en modo manual/emergencia
        await saveToDrive(elements.outputCanvas.toDataURL('image/png'), corrected.data);

        elements.processingArea.classList.add('hidden');
        elements.resultArea.classList.remove('hidden');
    }
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
        console.warn("Modo Local: No se puede guardar en Drive directamente.");
        // Podríamos intentar un fetch POST al GAS_WEB_APP_URL aquí si el usuario lo necesita
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
        window.addEventListener('touchmove', move);
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
    
    // Jugador (Priorizar manualCropHD)
    if (manualCropHD) {
        ctxOut.drawImage(playerCanvas, manualCropHD.x, manualCropHD.y, manualCropHD.w, manualCropHD.h, 100, 100, CONFIG.outputWidth - 200, CONFIG.outputHeight - 200);
    } else if (shouldRemoveBg) {
        const scale = (CONFIG.outputHeight * 0.85) / playerCanvas.height;
        const pW = playerCanvas.width * scale;
        const pH = playerCanvas.height * scale;
        ctxOut.save();
        ctxOut.shadowColor = "rgba(0,0,0,0.6)";
        ctxOut.shadowBlur = 30;
        ctxOut.drawImage(playerCanvas, (CONFIG.outputWidth - pW) / 2, (CONFIG.outputHeight - pH) + 20, pW, pH);
        ctxOut.restore();
    }
    
    await drawSportsTicker(ctxOut, player);
    
    // 2.5 LOGO DE LA APP (Arriba Izquierda - Bajado 15px de 60 a 75)
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1DBo2Nc5Ji0CZLXBzONl06AWJnmyI60X_?t=0");
        drawImageProp(ctxOut, logoImg, 100, 75, 300, 140, 0, 0);
    } catch(e) {}

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
    
    // 1. MI LOGO EN EL CARNET (Arriba Izquierda)
    try {
        const logoImg = await loadImg("https://lh3.googleusercontent.com/d/1DBo2Nc5Ji0CZLXBzONl06AWJnmyI60X_?t=0");
        drawImageProp(ctx, logoImg, 15, 20, 100, 50, 0, 0);
    } catch(e) {}

    // 2. INFO PARTIDO EN CARNET (Match Day REDUCIDO 70%)
    if (selectedMatchTeamA && selectedMatchTeamB) {
        const teamA = allTeams[selectedMatchTeamA];
        const teamB = allTeams[selectedMatchTeamB];
        const stage = document.getElementById('matchStage').value;
        const date = document.getElementById('matchDate').value || "";
        
        const ms = 40; 
        const totalW = (ms * 2) + 10;
        const startX = w - totalW - 20; 
        const my = 20;

        try {
            const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
            drawImageProp(ctx, imgA, startX, my, ms, ms);
            const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
            drawImageProp(ctx, imgB, startX + ms + 10, my, ms, ms);
        } catch(e) {}
        
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.textAlign = "center";
        const centerX = startX + totalW/2;
        ctx.font = "900 12px Outfit";
        ctx.fillText(stage, centerX, my + ms + 15);
        ctx.font = "400 10px Outfit";
        ctx.fillText(date, centerX, my + ms + 28);
    }

    // 3. (ELIMINADO NÚMERO GIGANTE)

    // Degradado inferior
    const grd = ctx.createLinearGradient(0, h-350, 0, h);
    grd.addColorStop(0, "transparent");
    grd.addColorStop(1, "black");
    ctx.fillStyle = grd;
    ctx.fillRect(0, h-350, w, 350);
    
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
        } catch(e) {}
    }

    // 5. NOMBRE DEL JUGADOR
    const finalX = 130 - 10; 
    ctx.textAlign = "left";
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "black";
    
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "400 35px Outfit";
    ctx.fillText(firstName, finalX, h - 110);
    
    ctx.fillStyle = "white";
    ctx.font = "900 65px Outfit";
    ctx.fillText(lastName.toUpperCase(), finalX, h - 50);
    ctx.restore();

    // 6. NÚMERO CON DEGRADADO (60% OPACIDAD)
    ctx.save();
    const grdNum = ctx.createLinearGradient(w - 150, h - 150, w, h - 50);
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };
    grdNum.addColorStop(0, hexToRgba(player.color, 0.6));
    grdNum.addColorStop(1, hexToRgba(player.color2 || player.color, 0.6));
    
    ctx.fillStyle = grdNum;
    ctx.font = "italic 900 160px Outfit";
    ctx.textAlign = "right";
    ctx.fillText(player.number, w - 30, h - 50);
    ctx.restore();

    // 7. Icono Capitán (C)
    if (player.name.includes("(C)")) {
        ctx.save();
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        ctx.arc(w - 60, h - 220, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.font = "900 32px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("C", w - 60, h - 208);
        ctx.restore();
    }
}


async function drawBackground(ctx, color, color2) {
    // 0. Fondo Negro Base
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, 1920, 1080);

    // 1. Imagen de Estadio (AL FONDO con opacidad)
    try {
        const bgImg = await loadImg("https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1920&auto=format&fit=crop");
        ctx.save();
        ctx.globalAlpha = 0.4; // Imagen al 40%
        ctx.drawImage(bgImg, 0, 0, 1920, 1080);
        ctx.restore();
    } catch(e) {}
    
    // 2. EFECTO CRISTAL AHUMADO (ENCIMA DE LA IMAGEN)
    ctx.save();
    // Simular el esmerilado aplicando un overlay con blur (el blur de Canvas afecta a lo que se dibuja)
    // Dibujamos una capa semi-transparente y le aplicamos desenfoque
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.filter = "blur(25px)"; 
    ctx.fillRect(-50, -50, 2020, 1180); // Un poco más grande por el blur
    ctx.restore();

    // 3. Overlay de color del equipo (Vignette suave)
    const grd = ctx.createRadialGradient(960, 540, 100, 960, 540, 1200);
    grd.addColorStop(0, "rgba(0, 0, 0, 0)");
    grd.addColorStop(1, (color2 || color) + "33"); 
    ctx.fillStyle = grd;
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
        } catch(e) {}
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
    
    // 5.5 ICONO CAPITÁN (Estilo Carnet - Subido 10px)
    if (player.name.includes("(C)")) {
        const nameW = ctx.measureText(`${player.number} | ${displayName}`).width;
        const capX = currentX + nameW + 40;
        ctx.save();
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        ctx.arc(capX, bY + 58, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.font = "900 28px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("C", capX, bY + 68);
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
    const y = 75; // Bajado 15px para alinear con el logo
    
    ctx.save();
    ctx.globalAlpha = 1.0;
    
    if (teamA.shieldWhite || teamA.shield) {
        try {
            const imgA = await loadImg(teamA.shieldWhite || teamA.shield);
            drawImageProp(ctx, imgA, x, y, sSize, sSize);
        } catch(e) {}
    }
    
    if (teamB.shieldWhite || teamB.shield) {
        try {
            const imgB = await loadImg(teamB.shieldWhite || teamB.shield);
            drawImageProp(ctx, imgB, x + sSize + 20, y, sSize, sSize);
        } catch(e) {}
    }
    ctx.restore();
    
    // Texto Info CENTRADO respecto a los escudos
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    const centerX = x + totalW/2;

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
    } catch(e) {
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
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Error loading image: " + url));
        img.src = url;
    });
}

initMatchSettings();
