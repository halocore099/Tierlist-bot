"use strict";

// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================

const fs = require("fs");

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let config = null;

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

/**
 * Load and validate configuration from config.json
 * @returns {Object} Configuration object
 */
function loadConfig() {
	try {
		const configData = fs.readFileSync("config.json", "utf-8");
		config = JSON.parse(configData);
		
		// Validate required fields
		if (!config.token) {
			throw new Error("'token' is required in config.json");
		}
		
		if (!config.waitlistChannelId) {
			throw new Error("'waitlistChannelId' is required in config.json");
		}
		
		if (!config.queueChannels || typeof config.queueChannels !== "object") {
			throw new Error("'queueChannels' object is required in config.json");
		}
		
		if (!config.queueChannels.EU || !config.queueChannels.NA || !config.queueChannels.AS) {
			throw new Error("'queueChannels' must have EU, NA, and AS channel IDs");
		}
		
		if (!config.testerRoleId) {
			throw new Error("'testerRoleId' is required in config.json");
		}
		
		if (!config.pingRoleId) {
			throw new Error("'pingRoleId' is required in config.json");
		}
		
		// Set defaults for optional fields
		if (typeof config.maxQueueSize !== "number") {
			config.maxQueueSize = 20;
		}
		
		if (typeof config.confirmationGracePeriod !== "number") {
			config.confirmationGracePeriod = 5;
		}
		
		console.log("✓ Config loaded successfully");
		return config;
	} catch (error) {
		console.error("Error loading config.json:", error.message);
		throw error;
	}
}

// ============================================================================
// CONFIGURATION GETTERS
// ============================================================================

/**
 * Get configuration value
 * @param {string} key - Configuration key
 * @returns {*} Configuration value
 */
function getConfig(key) {
	if (!config) {
		loadConfig();
	}
	return config[key];
}

/**
 * Get full configuration object
 * @returns {Object} Full configuration
 */
function getAllConfig() {
	if (!config) {
		loadConfig();
	}
	return config;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	loadConfig,
	getConfig,
	getAllConfig
};
