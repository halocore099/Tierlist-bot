"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Generic persistence utility for atomic file writes
 * @param {string} filePath - Path to the data file
 * @param {Object} data - Data to save
 */
function saveDataAtomic(filePath, data) {
	try {
		// Atomic write: write to temp file first, then rename (atomic operation)
		const tempFile = filePath + ".tmp";
		const jsonData = JSON.stringify(data, null, 2);
		
		// Write to temp file
		fs.writeFileSync(tempFile, jsonData, "utf-8");
		
		// Atomic rename (this is atomic on most filesystems)
		fs.renameSync(tempFile, filePath);
	} catch (error) {
		console.error(`Error saving data to ${filePath}:`, error.message);
		// Try to clean up temp file if it exists
		try {
			if (fs.existsSync(filePath + ".tmp")) {
				fs.unlinkSync(filePath + ".tmp");
			}
		} catch (cleanupError) {
			// Ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Generic persistence utility for loading data
 * @param {string} filePath - Path to the data file
 * @returns {Object} Loaded data object or empty object if file doesn't exist
 */
function loadDataAtomic(filePath) {
	try {
		if (fs.existsSync(filePath)) {
			const data = fs.readFileSync(filePath, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		console.error(`Error loading data from ${filePath}:`, error.message);
	}
	return {};
}

module.exports = { saveDataAtomic, loadDataAtomic };

