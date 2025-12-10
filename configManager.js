"use strict";

// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================

const fs = require("fs");
require("dotenv").config();

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

		// Load token from environment variable (more secure than config.json)
		config.token = process.env.DISCORD_TOKEN;

		// Validate required fields
		if (!config.token) {
			throw new Error("'DISCORD_TOKEN' environment variable is required (set in .env file)");
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
		
		if (!config.pingRoles || typeof config.pingRoles !== "object") {
			throw new Error("'pingRoles' object is required in config.json");
		}
		
		if (!config.pingRoles.EU || !config.pingRoles.NA || !config.pingRoles.AS) {
			throw new Error("'pingRoles' must have EU, NA, and AS role IDs");
		}
		
		// Set defaults for optional fields
		if (typeof config.maxQueueSize !== "number") {
			config.maxQueueSize = 20;
		}
		
		if (typeof config.confirmationGracePeriod !== "number") {
			config.confirmationGracePeriod = 5;
		}
		
		if (typeof config.waitlistCooldownDays !== "number") {
			config.waitlistCooldownDays = 30;
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

/**
 * Save configuration to config.json
 * @returns {boolean} True if saved successfully
 */
function saveConfig() {
	try {
		// Safety check: never save if token is missing (prevents accidental token loss)
		if (!config || !config.token) {
			console.error("⚠️ Cannot save config: token is missing. This prevents accidental token loss.");
			return false;
		}

		const jsonData = JSON.stringify(config, null, 2);
		fs.writeFileSync("config.json", jsonData, "utf-8");
		console.log("✓ Config saved to config.json");
		return true;
	} catch (error) {
		console.error("Error saving config.json:", error.message);
		return false;
	}
}

/**
 * Update a configuration value and save to file
 * @param {string} key - Configuration key (supports dot notation for nested keys like "queueChannels.EU")
 * @param {*} value - Value to set
 * @returns {boolean} True if updated and saved successfully
 */
function updateConfig(key, value) {
	if (!config) {
		loadConfig();
	}
	
	// Handle nested keys like "queueChannels.EU"
	if (key.includes(".")) {
		const keys = key.split(".");
		let obj = config;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!obj[keys[i]]) {
				obj[keys[i]] = {};
			}
			obj = obj[keys[i]];
		}
		obj[keys[keys.length - 1]] = value;
	} else {
		config[key] = value;
	}
	
	return saveConfig();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
	loadConfig,
	getConfig,
	getAllConfig,
	saveConfig,
	updateConfig
};
