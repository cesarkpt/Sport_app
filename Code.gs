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
  if (e && e.parameter && e.parameter.action === 'getAllTeamsData') {
    return createJsonResponse(getAllTeamsData());
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sports Hub Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Guardar TODOS los equipos en la Nube
 */
function saveAllTeamsData(allTeams) {
  try {
    const ss = getOrCreateSpreadsheet();
    const sheet = ss.getSheetByName("Config") || ss.insertSheet("Config");
    
    sheet.clear();
    sheet.getRange(1, 1).setValue("TeamsDataJSON");
    sheet.getRange(2, 1).setValue(JSON.stringify(allTeams));
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getAllTeamsData() {
  try {
    const ss = getOrCreateSpreadsheet();
    
    // 1. Intentar formato nuevo (JSON en Config)
    const configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      const json = configSheet.getRange(2, 1).getValue();
      if (json) return { success: true, data: JSON.parse(json) };
    }
    
    // 2. Fallback: Intentar formato viejo (Hoja Teams)
    const teamsSheet = ss.getSheetByName("Teams");
    if (teamsSheet) {
      const values = teamsSheet.getRange(2, 1, 5, 2).getValues();
      const team = {};
      values.forEach(row => {
        if (row[0] === "roster") team[row[0]] = JSON.parse(row[1]);
        else team[row[0]] = row[1];
      });
      // Convertir a formato multi-equipo
      const legacyData = { "legacy_1": { ...team, id: "legacy_1", code: team.name ? team.name.substring(0,3).toUpperCase() : "LEG" } };
      return { success: true, data: legacyData };
    }
    
    return { success: true, data: {} };
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

function saveAllTeamsData(allTeamsData) {
  try {
    const ss = getOrCreateSpreadsheet();
    let configSheet = ss.getSheetByName("Config");
    if (!configSheet) {
      configSheet = ss.insertSheet("Config");
      configSheet.appendRow(["JSON_DATA"]);
    }
    configSheet.getRange(2, 1).setValue(JSON.stringify(allTeamsData));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
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
    if (params.action === 'saveAllTeams') {
      const result = saveAllTeamsData(params.data);
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
