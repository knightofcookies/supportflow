// src/utils/dateTimeUtils.js

/**
 * Parses a backend-provided date string (assumed to be ISO 8601 with timezone, or naive assumed as UTC/local by Date constructor)
 * into a JavaScript Date object.
 * @param {string} backendDateString - The date string from the backend.
 * @returns {Date|null} - A Date object or null if parsing fails.
 */
export const parseBackendDateString = (backendDateString) => {
    if (!backendDateString || typeof backendDateString !== "string") {
        return null;
    }
    const dateObj = new Date(backendDateString);
    if (isNaN(dateObj.getTime())) {
        console.error("parseBackendDateString: Failed to parse date:", backendDateString);
        return null;
    }
    return dateObj;
};

/**
 * Formats a backend date string (or Date object) into a user-friendly IST display string.
 * @param {string|Date} dateInput - The date string from backend or a Date object.
 * @returns {string} - Formatted date string or "N/A" / "Invalid Date".
 */
export const formatBackendStringToIstDisplay = (dateInput) => {
    const dateObj = typeof dateInput === 'string' ? parseBackendDateString(dateInput) : dateInput;

    if (!dateObj || isNaN(dateObj.getTime())) {
        return dateInput === null || dateInput === undefined || (typeof dateInput === 'string' && dateInput.trim() === "")
            ? "N/A"
            : "Invalid Date";
    }

    try {
        return dateObj.toLocaleString("en-IN", { // Use 'en-IN' for Indian English conventions
            timeZone: "Asia/Kolkata", // Explicitly IST
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    } catch (e) {
        console.error("formatBackendStringToIstDisplay: Error formatting to IST:", e, dateObj.toISOString());
        return dateObj.toString() + " (Format Err)"; // Fallback
    }
};
