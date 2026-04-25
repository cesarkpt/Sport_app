/**
 * SPORTS HUB - BACKEND ENGINE (Google Apps Script)
 * Folder ID: 1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO (Escudos)
 */

const SHIELDS_FOLDER_ID = "1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO";

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sports Hub Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Obtener lista de escudos desde la carpeta de Drive
 */
function getShieldsFromDrive() {
  try {
    const folder = DriveApp.getFolderById(SHIELDS_FOLDER_ID);
    const files = folder.getFiles();
    const shields = [];
    
    while (files.hasNext()) {
      const file = files.next();
      // Solo imágenes
      if (file.getMimeType().startsWith('image/')) {
        shields.push({
          id: file.getId(),
          name: file.getName(),
          url: `https://lh3.googleusercontent.com/d/${file.getId()}=s200` // Thumbnail directo
        });
      }
    }
    return { success: true, data: shields };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Función para incluir archivos HTML (CSS/JS) en el index
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
