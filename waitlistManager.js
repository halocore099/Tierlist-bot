"use strict";

// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================

const path = require("path");
const { saveDataAtomic, loadDataAtomic } = require("./persistence-util");

// ============================================================================
// CONSTANTS
// ============================================================================

const DATA_FILE = path.join(__dirname, "waitlist-data.json");

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Waitlist data structure: { users: { userId: { userId, region, preferredServer, unlockedChannels: [], cooldownEndTime: null } } }
// Also tracks cooldowns: { cooldowns: { userId: cooldownEndTime } }
let waitlistData = { users: {}, cooldowns: {} };

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize waitlist manager and load persisted data
 */
function initialize() {
	try {
		const data = loadDataAtomic(DATA_FILE);
		waitlistData = {
			users: data.users ? data.users : {},
			cooldowns: data.cooldowns ? data.cooldowns : {}
		};
		console.log(`Loaded ${Object.keys(waitlistData.users).length} waitlist user(s) from persistence.`);
	} catch (error) {
		console.error("Error initializing waitlist manager:", error.message);
		waitlistData = { users: {}, cooldowns: {} };
	}
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save waitlist data to file
 */
function saveAllData() {
	try {
		saveDataAtomic(DATA_FILE, waitlistData);
	} catch (error) {
		console.error("Error saving waitlist data:", error.message);
	}
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Add user to waitlist
 * @param {string} userId - User ID
 * @param {string} region - Region (EU, NA, AS)
 * @param {string} preferredServer - Preferred server string
 * @param {number} cooldownDays - Cooldown period in days (optional, for checking)
 * @returns {Object} { success: boolean, reason?: string } - success true if added, false with reason if not
 */
function addToWaitlist(userId, region, preferredServer, cooldownDays = 30) {
	if (waitlistData.users[userId]) {
		return { success: false, reason: "already_in_waitlist" }; // Already in waitlist
	}
	
	// Check if user is on cooldown
	if (waitlistData.cooldowns[userId]) {
		const cooldownEndTime = waitlistData.cooldowns[userId];
		if (Date.now() < cooldownEndTime) {
			const daysRemaining = Math.ceil((cooldownEndTime - Date.now()) / (1000 * 60 * 60 * 24));
			return { success: false, reason: "cooldown", daysRemaining };
		}
		// Cooldown expired, remove it
		delete waitlistData.cooldowns[userId];
	}
	
	waitlistData.users[userId] = {
		userId,
		region,
		preferredServer,
		unlockedChannels: []
	};
	
	saveAllData();
	return { success: true };
}

/**
 * Set cooldown for a user (prevents them from rejoining waitlist)
 * @param {string} userId - User ID
 * @param {number} days - Cooldown period in days
 */
function setCooldown(userId, days) {
	const cooldownEndTime = Date.now() + (days * 24 * 60 * 60 * 1000);
	waitlistData.cooldowns[userId] = cooldownEndTime;
	saveAllData();
}

/**
 * Get user data from waitlist
 * @param {string} userId - User ID
 * @returns {Object|null} User data or null if not found
 */
function getUserData(userId) {
	return waitlistData.users[userId] || null;
}

/**
 * Get all waitlist users
 * @returns {Object} All waitlist users
 */
function getAllUsers() {
	return waitlistData.users;
}

/**
 * Remove user from waitlist
 * @param {string} userId - User ID
 * @param {boolean} preserveChannelPermissions - If true, don't revoke channel permissions (for testers)
 * @returns {Object|null} User data if removed, null if not found
 */
function removeFromWaitlist(userId, preserveChannelPermissions = false) {
	const userData = waitlistData.users[userId];
	if (!userData) {
		return null;
	}
	
	// Store unlocked channels before removing (needed for permission cleanup)
	const unlockedChannels = preserveChannelPermissions ? [] : userData.unlockedChannels;
	
	delete waitlistData.users[userId];
	saveAllData();
	
	// Return user data with unlocked channels for permission cleanup
	return {
		...userData,
		unlockedChannels: unlockedChannels
	};
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

/**
 * Unlock region channel for user
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID to unlock
 */
function unlockRegionChannel(userId, channelId) {
	if (!waitlistData.users[userId]) {
		return;
	}
	
	if (!waitlistData.users[userId].unlockedChannels.includes(channelId)) {
		waitlistData.users[userId].unlockedChannels.push(channelId);
		saveAllData();
	}
}

/**
 * Check if user has unlocked a region
 * @param {string} userId - User ID
 * @param {string} region - Region to check
 * @returns {boolean} True if user has unlocked the region
 */
function hasUnlockedRegion(userId, region) {
	const userData = waitlistData.users[userId];
	if (!userData) {
		return false;
	}
	
	return userData.region === region;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Clear all waitlist data (users and cooldowns)
 */
function clearAllData() {
	waitlistData = { users: {}, cooldowns: {} };
	saveAllData();
}

module.exports = {
	initialize,
	saveAllData,
	addToWaitlist,
	getUserData,
	unlockRegionChannel,
	hasUnlockedRegion,
	removeFromWaitlist,
	getAllUsers,
	setCooldown,
	clearAllData
};
