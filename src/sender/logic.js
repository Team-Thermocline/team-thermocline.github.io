export const SCHEMA_VERSION = 1;
export const HOST_ID = "thermocline-webapp";

export function parseJsonLine(line) {
    try {
        return { ok: true, value: JSON.parse(line) };
    } catch (error) {
        return { ok: false, error };
    }
}


