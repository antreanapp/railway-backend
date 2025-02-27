"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanData = cleanData;
// src/utils/cleanData.ts
function cleanData(obj) {
    if (Array.isArray(obj)) {
        return obj.map(cleanData);
    }
    else if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        Object.entries(obj).forEach(([key, value]) => {
            // Lewati properti jika nilainya undefined atau merupakan fungsi
            if (value === undefined || typeof value === 'function') {
                return;
            }
            cleaned[key] = cleanData(value);
        });
        return cleaned;
    }
    return obj;
}
