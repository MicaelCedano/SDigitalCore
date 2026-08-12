import ExcelJS from "exceljs";

export interface ParsedExcelRow {
    imei: string;
    rawModel: string;
    brand: string;
    modelName: string;
    storageGb: number;
    color: string | null;
}

export function parseIphoneModel(rawModel: string): { modelName: string; storageGb: number; color: string | null } {
    if (!rawModel) throw new Error("Modelo vacío");

    let s = rawModel.split(/\s+/).join(" ").trim();
    let color: string | null = null;
    let modelPart: string = "";
    let gb: number = 0;

    // 1) Match TB (1TB, 2TB, etc.)
    const tbMatch = s.match(/(\d+)\s*TB/i);
    if (tbMatch) {
        const tbValue = parseInt(tbMatch[1]);
        gb = tbValue * 1024;
        modelPart = s.substring(0, tbMatch.index).trim();
        color = s.substring(tbMatch.index! + tbMatch[0].length).trim();
    } else {
        // 2) Match GB (128GB, 256 GB, etc.)
        const gbMatch = s.match(/(\d+)\s*GB/i);
        if (gbMatch) {
            gb = parseInt(gbMatch[1]);
            modelPart = s.substring(0, gbMatch.index).trim();
            color = s.substring(gbMatch.index! + gbMatch[0].length).trim();
        } else {
            // 3) Fallback: look for last number as GB
            const tokens = s.split(" ");
            let lastNumIdx = -1;
            for (let i = 0; i < tokens.length; i++) {
                if (/^\d+$/.test(tokens[i])) {
                    lastNumIdx = i;
                }
            }
            if (lastNumIdx === -1) {
                throw new Error(`No se encontraron GB/TB en el texto de modelo: '${s}'`);
            }
            gb = parseInt(tokens[lastNumIdx]);
            modelPart = tokens.slice(0, lastNumIdx).join(" ").trim();
            color = tokens.slice(lastNumIdx + 1).join(" ").trim();
        }
    }

    if (!modelPart) {
        throw new Error(`No se pudo determinar el modelo en: '${s}'`);
    }

    // --- Color Extraction Fallback from modelPart (if color is empty) ---
    if (!color && modelPart) {
        const commonColors = [
            'Space Black', 'Space Gray', 'Midnight Green', 'Pacific Blue', 'Sierra Blue',
            'Deep Purple', 'Rose Gold', 'Jet Black', 'Matte Black', 'Alpine Green',
            'Graphite', 'Starlight', 'Midnight', 'Black', 'White', 'Red', 'Blue',
            'Green', 'Yellow', 'Purple', 'Gold', 'Silver', 'Pink', 'Coral',
            'Titanium', 'Natural Titanium', 'Blue Titanium', 'White Titanium',
            'Black Titanium', 'Desert Titanium', 'Gray', 'Grey', 'Teal', 'Ultramarine',
            'Deep Blue', 'Cosmic Orange', 'DeepBlue'
        ];
        // Sort by length descending to match longer names first
        commonColors.sort((a, b) => b.length - a.length);

        for (const col of commonColors) {
            const regex = new RegExp(`\\b${col}$`, 'i');
            const match = modelPart.match(regex);
            if (match) {
                color = modelPart.substring(match.index!);
                modelPart = modelPart.substring(0, match.index!).trim();
                break;
            }
        }
    }

    // Cleanup color
    if (color && (color.toLowerCase() === 'nan' || color.toLowerCase() === 'none' || color === '')) {
        color = null;
    }

    return { modelName: modelPart, storageGb: gb, color: color };
}

export interface ExcelImportResult {
    rows: ParsedExcelRow[];
    errors: { row: number; imei: string; reason: string }[];
}

export async function readPurchaseExcel(file: File): Promise<ExcelImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());

    const worksheet = workbook.worksheets[0];
    const rows: ParsedExcelRow[] = [];
    const errors: { row: number; imei: string; reason: string }[] = [];

    let imeiCol = -1;
    let modelCol = -1;
    let colorCol = -1;

    // Standardize headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.text?.toString().toLowerCase().trim();
        if (val.includes("imei")) imeiCol = colNumber;
        if (val.includes("modelo") || val.includes("model")) modelCol = colNumber;
        if (val.includes("color")) colorCol = colNumber;
    });

    if (imeiCol === -1 || modelCol === -1) {
        throw new Error("El archivo debe contener columnas 'IMEI' y 'Modelo'.");
    }

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const imeiRaw = row.getCell(imeiCol).text?.toString().trim();
        const rawModel = row.getCell(modelCol).text?.toString().trim();

        if (!imeiRaw && !rawModel) return; // Completely empty row

        if (!imeiRaw) {
            errors.push({ row: rowNumber, imei: "N/A", reason: "IMEI vacío" });
            return;
        }

        const imei = imeiRaw.replace(/['\s]/g, ""); // Remove quotes or spaces often found in Excel IMEIs

        if (!rawModel) {
            errors.push({ row: rowNumber, imei, reason: "Modelo vacío" });
            return;
        }

        // Validation - Be more flexible with IMEI but warn if not digits
        if (!/^\d+$/.test(imei)) {
            errors.push({ row: rowNumber, imei, reason: "IMEI contiene caracteres no numéricos" });
            return;
        }

        if (imei.length !== 15) {
            errors.push({ row: rowNumber, imei, reason: `IMEI tiene longitud incorrecta (${imei.length} dígitos)` });
            return;
        }

        try {
            const parsed = parseIphoneModel(rawModel);

            // If color was in a separate column and not found in string
            let finalColor = parsed.color;
            if (!finalColor && colorCol !== -1) {
                const colVal = row.getCell(colorCol).text?.toString().trim();
                if (colVal && colVal.toLowerCase() !== 'nan' && colVal.toLowerCase() !== 'none') {
                    finalColor = colVal;
                }
            }

            rows.push({
                imei,
                rawModel,
                brand: "Apple",
                modelName: parsed.modelName,
                storageGb: parsed.storageGb,
                color: finalColor
            });
        } catch (e: any) {
            errors.push({ row: rowNumber, imei, reason: e.message || "Error al procesar el nombre del modelo" });
        }
    });

    return { rows, errors };
}
