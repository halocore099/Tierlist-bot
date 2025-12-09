"use strict";

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "queue-data.json");

/**
 * Load queue data from file
 * @returns {Object} Queue data object
 */
function loadData() {
	try {
		if (fs.existsSync(DATA_FILE)) {
			const data = fs.readFileSync(DATA_FILE, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		console.error("Error loading queue data:", error.message);
	}
	return {};
}

/**
 * Save queue data to file using atomic writes (prevents corruption on crash)
 * @param {Object} data - Queue data to save
 */
function saveData(data) {
	try {
		// Atomic write: write to temp file first, then rename (atomic operation)
		const tempFile = DATA_FILE + ".tmp";
		const jsonData = JSON.stringify(data, null, 2);
		
		// Write to temp file
		fs.writeFileSync(tempFile, jsonData, "utf-8");
		
		// Atomic rename (this is atomic on most filesystems)
		fs.renameSync(tempFile, DATA_FILE);
	} catch (error) {
		console.error("Error saving queue data:", error.message);
		// Try to clean up temp file if it exists
		try {
			if (fs.existsSync(DATA_FILE + ".tmp")) {
				fs.unlinkSync(DATA_FILE + ".tmp");
			}
		} catch (cleanupError) {
			// Ignore cleanup errors
		}
	}
}

module.exports = { loadData, saveData };

