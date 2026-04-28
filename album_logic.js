
function openAlbumEditor() {
    const resArea = document.getElementById('resultArea');
    if (resArea) resArea.classList.remove('hidden');
    
    // Buscar el botón de la pestaña álbum para marcarlo como activo
    const albumBtn = document.querySelector('.tab-btn[onclick*="album"]');
    showResultTab('album', albumBtn);
    
    // Cargar selector de equipos dinámicamente
    const selector = document.getElementById('albumTeamSelector');
    if (selector) {
        selector.innerHTML = '';
        const teams = Object.values(allTeams);
        if (teams.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'SIN EQUIPOS';
            selector.appendChild(opt);
        } else {
            teams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.name;
                opt.textContent = t.name.toUpperCase();
                // Pre-seleccionar el equipo A del partido si existe
                if (selectedMatchTeamA === t.name) opt.selected = true;
                selector.appendChild(opt);
            });
        }
    }
    renderAlbumSlots();
    generateAlbum();
}
