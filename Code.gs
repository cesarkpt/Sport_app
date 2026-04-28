/**
 * SPORTS HUB - BACKEND ENGINE (Google Apps Script)
 * Folder ID: 1BZ9_Qn6g2AvtPD8A3eShmIv2_H7SZioR (Raíz)
 * Shields ID: 1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO
 */

const MAIN_FOLDER_ID = "1BZ9_Qn6g2AvtPD8A3eShmIv2_H7SZioR";
const SHIELDS_FOLDER_ID = "1XUHCYb3yEPvDgqHIz0dNgsiNITkJdVCO";
const SPREADSHEET_NAME = "SportsHub_Database";

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getShields') {
    return createJsonResponse(getShieldsFromDrive());
  }
  if (e && e.parameter && e.parameter.action === 'getAllTeamsData') {
    return createJsonResponse(getAllTeamsData());
  }
  return HtmlService.createHtmlOutput("Sports Hub Backend Active");
}

function doPost(e) {
  try {
    logAction("POST_RECEIVED", "Iniciando recepción de datos");
    
    if (!e.postData || !e.postData.contents) {
      logAction("POST_ERROR", "No se recibieron datos en postData");
      return createJsonResponse({ success: false, error: "No data received" });
    }
    
    const params = JSON.parse(e.postData.contents);
    logAction("ACTION_RECOGNIZED", "Acción: " + params.action);
    
    if (params.action === 'saveAllTeams') {
      const result = saveAllTeamsData(params.data);
      logAction("SAVE_RESULT", JSON.stringify(result));
      return createJsonResponse(result);
    }
    
    if (params.action === 'saveImage') {
      return createJsonResponse(saveProcessedImage(params.image, params.fileName, params.teamName));
    }
    
    return createJsonResponse({ success: false, error: "Invalid action" });
  } catch (err) {
    logAction("CRITICAL_ERROR", err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function saveAllTeamsData(allTeamsData) {
  try {
    const ss = getOrCreateSpreadsheet();
    let configSheet = ss.getSheetByName("Config") || ss.insertSheet("Config");
    
    // Log del tamaño de los datos
    const jsonString = JSON.stringify(allTeamsData);
    logAction("DATA_SIZE", "El JSON mide: " + jsonString.length + " caracteres");
    
    if (jsonString.length > 50000) {
      logAction("LIMIT_EXCEEDED", "Error: Se superó el límite de 50k de Google Sheets");
      return { success: false, error: "Límite de caracteres excedido" };
    }

    configSheet.getRange(1, 1).setValue("JSON_DATA_DATABASE");
    configSheet.getRange(2, 1).setValue(jsonString);
    
    return { success: true, timestamp: new Date().toISOString() };
  } catch (e) {
    logAction("SAVE_EXCEPTION", e.toString());
    return { success: false, error: e.toString() };
  }
}

function getAllTeamsData() {
  try {
    const ss = getOrCreateSpreadsheet();
    const configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      const json = configSheet.getRange(2, 1).getValue();
      if (json) return { success: true, data: JSON.parse(json) };
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

function logAction(type, message) {
  try {
    const ss = getOrCreateSpreadsheet();
    let logSheet = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
    logSheet.appendRow([new Date(), type, message]);
  } catch(e) {}
}

function testManualSave() {
  const testData = { test: "Conexión exitosa", date: new Date().toLocaleString() };
  const result = saveAllTeamsData(testData);
  Logger.log(result);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

function getShieldsFromDrive() {
  try {
    const folder = DriveApp.getFolderById(SHIELDS_FOLDER_ID);
    const files = folder.getFiles();
    const shields = [];
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType().startsWith('image/')) {
        shields.push({ id: file.getId(), name: file.getName(), url: `https://lh3.googleusercontent.com/d/${file.getId()}=s200` });
      }
    }
    return { success: true, data: shields };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function saveProcessedImage(base64Data, fileName, teamName) {
  try {
    const mainFolder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    const teamFolders = mainFolder.getFoldersByName(teamName);
    const teamFolder = teamFolders.hasNext() ? teamFolders.next() : mainFolder.createFolder(teamName);
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, "image/png", fileName);
    const file = teamFolder.createFile(blob);
    return { success: true, url: file.getUrl() };
  } catch (e) { return { success: false, error: e.toString() }; }
}
