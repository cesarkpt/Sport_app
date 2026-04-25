/**
 * SPORTS HUB - BACKEND ENGINE (Google Apps Script)
 * Folder ID: 1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO (Escudos)
 */

const SHIELDS_FOLDER_ID = "1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO";
const MAIN_FOLDER_ID = "1BZ9_Qn6g2AvtPD8A3eShmIv2_H7SZioR";
const SPREADSHEET_NAME = "SportsHub_Database";

function doGet(e) {
  // Manejo de API para Get
  if (e && e.parameter && e.parameter.action === 'getShields') {
    return createJsonResponse(getShieldsFromDrive());
  }
  if (e && e.parameter && e.parameter.action === 'getTeamData') {
    return createJsonResponse(getTeamData());
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sports Hub Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función para guardar datos desde Web App (POST/Direct)
 */
function saveTeamData(data) {
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName("Teams") || ss.insertSheet("Teams");
    
    // Limpiar y guardar (Sistema simple de 1 equipo por ahora o tabla de equipos)
    sheet.clear();
    sheet.getRange(1, 1, 1, 2).setValues([["Property", "Value"]]);
    sheet.getRange(2, 1, 5, 2).setValues([
      ["name", data.name],
      ["color1", data.color1],
      ["color2", data.color2],
      ["shield", data.shield],
      ["roster", JSON.stringify(data.roster)]
    ]);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getTeamData() {
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName("Teams");
    if (!sheet) return { success: true, data: null };
    
    const values = sheet.getRange(2, 1, 5, 2).getValues();
    const data = {};
    values.forEach(row => {
      if (row[0] === "roster") {
        data[row[0]] = JSON.parse(row[1]);
      } else {
        data[row[0]] = row[1];
      }
    });
    
    return { success: true, data: data };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getOrCreateSpreadsheet() {
  const folder = DriveApp.getFolderById(MAIN_FOLDER_ID);
  const files = folder.getFilesByName(SPREADSHEET_NAME);
  
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  } else {
    const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    const file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    return ss;
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
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

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.action === 'saveImage') {
      const result = saveProcessedImage(params.image, params.fileName, params.teamName);
      return createJsonResponse(result);
    }
    if (params.action === 'saveTeam') {
      const result = saveTeamData(params.data);
      return createJsonResponse(result);
    }
  } catch (e) {
    return createJsonResponse({ success: false, error: e.toString() });
  }
}

function saveProcessedImage(base64Data, fileName, teamName) {
  try {
    const mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    
    // Buscar o crear carpeta del equipo
    const teamFolders = mainFolder.getFoldersByName(teamName);
    let teamFolder;
    if (teamFolders.hasNext()) {
      teamFolder = teamFolders.next();
    } else {
      teamFolder = mainFolder.createFolder(teamName);
    }
    
    // Limpiar base64 header
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    
    const file = teamFolder.createFile(blob);
    return { success: true, url: file.getUrl() };
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
