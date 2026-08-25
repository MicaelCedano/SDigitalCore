/**
 * Puente de Google Apps Script para las fotos de QC.
 *
 * 1. Crea un proyecto en script.google.com.
 * 2. Pega este archivo.
 * 3. Cambia ROOT_FOLDER_ID y SHARED_TOKEN.
 * 4. Implementa como aplicación web ejecutada por tu cuenta y accesible
 *    para cualquiera que tenga el enlace.
 *
 * Las fotos quedan en subcarpetas por IMEI y se comparten como "cualquiera
 * con el enlace" para que el personal de QC pueda verlas desde SDigitalCore.
 */

const ROOT_FOLDER_ID = "14OnonlgAq1Sh-7XicclcR6zYuQatXDKC";
const SHARED_TOKEN = "CAMBIA_ESTE_TOKEN_LARGO";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.token !== SHARED_TOKEN) return json({ success: false, error: "No autorizado." });

    if (payload.action === "upload") return uploadPhotos(payload);
    if (payload.action === "delete") return deletePhoto(payload);
    return json({ success: false, error: "Acción no soportada." });
  } catch (error) {
    return json({ success: false, error: String(error && error.message ? error.message : error) });
  }
}

function uploadPhotos(payload) {
  const imei = cleanName(payload.imei || payload.deviceId || "equipo");
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const folder = getOrCreateFolder(root, imei);
  const usedNumbers = getUsedNumbers(folder, imei);
  const files = Array.isArray(payload.files) ? payload.files : [];
  const uploaded = [];

  files.forEach((item) => {
    const nextNumber = nextNumber(usedNumbers);
    usedNumbers.push(nextNumber);
    const extension = item.extension || "webp";
    const name = imei + " - Foto " + nextNumber + "." + extension;
    const bytes = Utilities.base64Decode(item.base64);
    const blob = Utilities.newBlob(bytes, item.mimeType || "image/webp", name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    uploaded.push({
      id: file.getId(),
      name: file.getName(),
      url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
    });
  });

  return json({ success: true, uploaded: uploaded });
}

function deletePhoto(payload) {
  if (!payload.fileId) return json({ success: false, error: "Falta el fileId." });
  DriveApp.getFileById(payload.fileId).setTrashed(true);
  return json({ success: true });
}

function getOrCreateFolder(root, name) {
  const matches = root.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : root.createFolder(name);
}

function getUsedNumbers(folder, imei) {
  const used = [];
  const files = folder.getFiles();
  const pattern = new RegExp("^" + escapeRegExp(imei) + " - Foto ([0-9]+)\\.", "i");
  while (files.hasNext()) {
    const match = files.next().getName().match(pattern);
    if (match) used.push(Number(match[1]));
  }
  return used;
}

function nextNumber(used) {
  let number = 1;
  while (used.indexOf(number) !== -1) number++;
  return number;
}

function cleanName(value) {
  return String(value).replace(/[\\/:*?"<>|#%{}~&]/g, "-").trim().slice(0, 120) || "equipo";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
