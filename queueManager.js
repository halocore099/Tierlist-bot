"use strict";

const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const path = require("path");
const { saveDataAtomic, loadDataAtomic } = require("./persistence-util");
const configManager = require("./configManager");

const DATA_FILE = path.join(__dirname, "queue-data.json");

// Queue structure: { EU: { users: [], activeTesters: [], state: "closed"|"open"|"confirmation_period", messageId, confirmationMessageId, previousUsers: [], confirmedUsers: [], confirmationEndTime: null }, ... }
let queues = {};

// Persistence optimization: track if data has changed
let dataChanged = false;
let lastSaveTime = 0;
const SAVE_DEBOUNCE_MS = 2000; // Save at most every 2 seconds (unless forced)

/**
 * Initialize queue manager and load persisted data
 */
function initialize() {
	try {
		const data = loadDataAtomic(DATA_FILE);
		queues = data.queues || {};
		console.log(`Loaded ${Object.keys(queues).length} queue(s) from persistence.`);
	} catch (error) {
		console.error("Error initializing queue manager:", error.message);
		queues = {};
	}
}

/**
 * Get queue for a region
 * @param {string} region - Region (EU, NA, AS)
 * @returns {Object|null} Queue object or null
 */
function getQueue(region) {
	if (!queues[region]) {
		queues[region] = {
			users: [],
			activeTesters: [],
			state: "closed",
			messageId: null,
			confirmationMessageId: null,
			previousUsers: [],
			confirmedUsers: [],
			confirmationEndTime: null
		};
	}
	return queues[region];
}

/**
 * Get all queues
 * @returns {Object} All queues
 */
function getAllQueues() {
	return queues;
}

/**
 * Check if queue is open
 * @param {string} region - Region
 * @returns {boolean} True if queue is open
 */
function isQueueOpen(region) {
	const queue = getQueue(region);
	return queue.state === "open";
}

/**
 * Save queue data to file (with debouncing)
 * @param {boolean} force - Force save immediately (bypass debounce)
 */
function saveAllQueues(force = false) {
	try {
		const now = Date.now();
		
		// If forced or data changed and enough time has passed, save
		if (force || (dataChanged && (now - lastSaveTime) >= SAVE_DEBOUNCE_MS)) {
			saveDataAtomic(DATA_FILE, { queues });
			dataChanged = false;
			lastSaveTime = now;
		}
	} catch (error) {
		console.error("Error saving queue data:", error.message);
	}
}

/**
 * Mark data as changed (for optimized persistence)
 */
function markDataChanged() {
	dataChanged = true;
}

/**
 * Add user to queue
 * @param {string} region - Region
 * @param {string} userId - User ID
 * @returns {boolean} True if added, false if already in queue or queue is full/closed
 */
function addUser(region, userId) {
	const queue = getQueue(region);
	
	// Check if queue is open
	if (queue.state !== "open") {
		return false;
	}
	
	// Check if user is already in queue
	if (queue.users.some(u => u.userId === userId)) {
		return false;
	}
	
	// Check max queue size
	const maxSize = configManager.getConfig("maxQueueSize") || 20;
	if (queue.users.length >= maxSize) {
		return false;
	}
	
	queue.users.push({ userId, position: queue.users.length + 1 });
	markDataChanged();
	saveAllQueues();
	return true;
}

/**
 * Remove user from queue
 * @param {string} region - Region
 * @param {string} userId - User ID
 * @returns {boolean} True if removed
 */
function removeUser(region, userId) {
	const queue = getQueue(region);
	if (!queue) return false;
	
	const initialLength = queue.users.length;
	queue.users = queue.users.filter(u => u.userId !== userId);
	
	// Renumber positions
	queue.users.forEach((user, index) => {
		user.position = index + 1;
	});
	
	if (queue.users.length !== initialLength) {
		markDataChanged();
		saveAllQueues();
		return true;
	}
	return false;
}

/**
 * Get next user from queue (position 1)
 * @param {string} region - Region
 * @returns {Object|null} User object or null
 */
function getNextUser(region) {
	const queue = getQueue(region);
	if (!queue || queue.users.length === 0) {
		return null;
	}
	
	// Get user at position 1
	const nextUser = queue.users.find(u => u.position === 1);
	return nextUser || null;
}

/**
 * Remove user at position 1 and advance queue
 * @param {string} region - Region
 * @returns {Object|null} Removed user or null
 */
function removeNextUser(region) {
	const queue = getQueue(region);
	if (!queue || queue.users.length === 0) {
		return null;
	}
	
	// Remove user at position 1
	const removedUser = queue.users.find(u => u.position === 1);
	if (!removedUser) {
		return null;
	}
	
	queue.users = queue.users.filter(u => u.userId !== removedUser.userId);
	
	// Renumber positions
	queue.users.forEach((user, index) => {
		user.position = index + 1;
	});
	
	markDataChanged();
	saveAllQueues();
	return removedUser;
}

/**
 * Set tester as active
 * @param {string} region - Region
 * @param {string} testerId - Tester ID
 * @returns {boolean} True if tester is now active
 */
function setTesterActive(region, testerId) {
	const queue = getQueue(region);
	
	// Remove tester from queue as a player if present
	removeUser(region, testerId);
	
	// Add tester to active testers if not already there
	if (!queue.activeTesters.includes(testerId)) {
		queue.activeTesters.push(testerId);
	}
	
	// If queue was closed and has previous users, start confirmation period
	if (queue.state === "closed" && queue.previousUsers.length > 0) {
		const gracePeriod = configManager.getConfig("confirmationGracePeriod") || 5;
		startConfirmationPeriod(region, gracePeriod);
	} else if (queue.state === "closed") {
		// Open queue normally
		queue.state = "open";
	}
	
	markDataChanged();
	saveAllQueues();
	return true;
}

/**
 * Set tester as inactive
 * @param {string} region - Region
 * @param {string} testerId - Tester ID
 * @returns {boolean} True if tester was removed
 */
function setTesterInactive(region, testerId) {
	const queue = getQueue(region);
	if (!queue) return false;
	
	const initialLength = queue.activeTesters.length;
	queue.activeTesters = queue.activeTesters.filter(id => id !== testerId);
	
	// If no active testers, close queue and save previous users
	if (queue.activeTesters.length === 0 && initialLength > 0) {
		closeQueue(region);
	} else {
		markDataChanged();
		saveAllQueues();
	}
	return queue.activeTesters.length !== initialLength;
}

/**
 * Open queue
 * @param {string} region - Region
 */
function openQueue(region) {
	const queue = getQueue(region);
	queue.state = "open";
	markDataChanged();
	saveAllQueues();
}

/**
 * Close queue and save previous users
 * @param {string} region - Region
 */
function closeQueue(region) {
	const queue = getQueue(region);
	if (!queue) return;
	
	// Save current users to previousUsers with their positions
	queue.previousUsers = queue.users.map(u => ({
		userId: u.userId,
		position: u.position
	}));
	
	// Clear current users
	queue.users = [];
	queue.state = "closed";
	queue.confirmedUsers = [];
	queue.confirmationEndTime = null;
	
	markDataChanged();
	saveAllQueues(true); // Force save on queue close
}

/**
 * Start confirmation period
 * @param {string} region - Region
 * @param {number} gracePeriodMinutes - Grace period in minutes
 */
function startConfirmationPeriod(region, gracePeriodMinutes) {
	const queue = getQueue(region);
	if (!queue) return;
	
	queue.state = "confirmation_period";
	queue.confirmationEndTime = Date.now() + (gracePeriodMinutes * 60 * 1000);
	queue.confirmedUsers = [];
	
	markDataChanged();
	saveAllQueues(true); // Force save when starting confirmation period
}

/**
 * Confirm user is still active
 * @param {string} region - Region
 * @param {string} userId - User ID
 * @returns {boolean} True if confirmed
 */
function confirmStillActive(region, userId) {
	const queue = getQueue(region);
	if (!queue || queue.state !== "confirmation_period") {
		return false;
	}
	
	// Check if user was in previousUsers
	const wasInPrevious = queue.previousUsers.some(pu => pu.userId === userId);
	if (!wasInPrevious) {
		return false;
	}
	
	// Add to confirmed users if not already there
	if (!queue.confirmedUsers.includes(userId)) {
		queue.confirmedUsers.push(userId);
		markDataChanged();
		saveAllQueues(); // Debounced save
		return true;
	}
	
	return false;
}

/**
 * Process confirmation period - renumber queue based on confirmed users
 * @param {string} region - Region
 * @returns {boolean} True if processed
 */
function processConfirmationPeriod(region) {
	const queue = getQueue(region);
	if (!queue || queue.state !== "confirmation_period") {
		return false;
	}
	
	// Filter previousUsers to only include confirmed users
	const confirmedPreviousUsers = queue.previousUsers.filter(pu => 
		queue.confirmedUsers.includes(pu.userId)
	);
	
	// Sort by original position
	confirmedPreviousUsers.sort((a, b) => a.position - b.position);
	
	// Renumber positions (fill gaps)
	queue.users = confirmedPreviousUsers.map((pu, index) => ({
		userId: pu.userId,
		position: index + 1
	}));
	
	// Clear confirmation period data
	queue.previousUsers = [];
	queue.confirmedUsers = [];
	queue.confirmationEndTime = null;
	queue.confirmationMessageId = null;
	queue.state = "open";
	
	markDataChanged();
	saveAllQueues(true); // Force save when processing confirmation period
	return true;
}

/**
 * Check if confirmation period has ended
 * @param {string} region - Region
 * @returns {boolean} True if period has ended
 */
function hasConfirmationPeriodEnded(region) {
	const queue = getQueue(region);
	if (!queue || queue.state !== "confirmation_period") {
		return false;
	}
	
	if (!queue.confirmationEndTime) {
		return false;
	}
	
	return Date.now() >= queue.confirmationEndTime;
}

/**
 * Build queue embed
 * @param {string} region - Region
 * @returns {EmbedBuilder} Discord embed
 */
function buildQueueEmbed(region) {
	const queue = getQueue(region);
	const config = configManager.getAllConfig();
	
	let status, statusNote, title, color;
	
	if (queue.state === "confirmation_period") {
		const timeLeft = Math.max(0, Math.ceil((queue.confirmationEndTime - Date.now()) / 1000));
		const minutes = Math.floor(timeLeft / 60);
		const seconds = timeLeft % 60;
		
		status = "⏳ **CONFIRMATION PERIOD**";
		statusNote = `\n\n⏰ **${minutes}:${seconds.toString().padStart(2, '0')}** remaining to confirm you're still active!`;
		title = `${region} Queue - Confirmation Period`;
		color = 0xFFA500; // Orange
		
		// Show previous users and confirmation status
		const previousUsersList = queue.previousUsers.length > 0
			? queue.previousUsers.map(pu => {
				const isConfirmed = queue.confirmedUsers.includes(pu.userId);
				return `${pu.position}. <@${pu.userId}> ${isConfirmed ? "✅" : "⏳"}`;
			}).join("\n")
			: "No previous users.";
		
		const embed = new EmbedBuilder()
			.setTitle(title)
			.setColor(color)
			.setDescription(`**Status**: ${status}${statusNote}
			
**Previous Queue Members** (click "Still Active" button to confirm):
${previousUsersList}

**Active Testers**: ${queue.activeTesters.length > 0 ? queue.activeTesters.map(id => `<@${id}>`).join(", ") : "None"}`);
		
		return embed;
	} else if (queue.state === "closed") {
		status = "🔴 **CLOSED**";
		statusNote = "\n\n⚠️ *The queue is currently closed. No testers are available.*";
		title = `${region} Queue - Closed`;
		color = 0xFF0000; // Red
		
		const queueList = queue.users.length > 0
			? queue.users.map(u => `${u.position}. <@${u.userId}>`).join("\n")
			: "No one in queue.";
		
		const embed = new EmbedBuilder()
			.setTitle(title)
			.setColor(color)
			.setDescription(`**Status**: ${status}${statusNote}
			
**Queue**:
${queueList}

**Active Testers**: ${queue.activeTesters.length > 0 ? queue.activeTesters.map(id => `<@${id}>`).join(", ") : "None"}`);
		
		return embed;
	} else {
		// Open state
		status = "🟢 **OPEN**";
		statusNote = "";
		title = `${region} Queue - Open`;
		color = 0x00FF00; // Green
		
		const queueList = queue.users.length > 0
			? queue.users.map(u => `${u.position}. <@${u.userId}>`).join("\n")
			: "No one in queue.";
		
		const embed = new EmbedBuilder()
			.setTitle(title)
			.setColor(color)
			.setDescription(`**Status**: ${status}${statusNote}
			
**Queue** (${queue.users.length}/${config.maxQueueSize || 20}):
${queueList}

**Active Testers**: ${queue.activeTesters.length > 0 ? queue.activeTesters.map(id => `<@${id}>`).join(", ") : "None"}`);
		
		return embed;
	}
}

/**
 * Build queue buttons
 * @param {string} region - Region
 * @returns {Array<ActionRowBuilder>} Array of Discord action rows with buttons
 */
function buildQueueButtons(region) {
	const queue = getQueue(region);
	if (!queue) {
		return [];
	}
	
	const isOpen = queue.state === "open";
	const isConfirmationPeriod = queue.state === "confirmation_period";
	const isClosed = queue.state === "closed";
	
	const row = new ActionRowBuilder();
	
	if (isConfirmationPeriod) {
		// During confirmation period, no buttons for joining
		return [];
	} else {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`joinQueue_${region}`)
				.setLabel("Join Queue")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(!isOpen)
		);
	}
	
	return [row];
}

/**
 * Build confirmation message embed and button
 * @param {string} region - Region
 * @returns {Object} Object with embed and button row
 */
function buildConfirmationMessage(region) {
	const queue = getQueue(region);
	if (!queue || queue.state !== "confirmation_period") {
		return null;
	}
	
	const timeLeft = Math.max(0, Math.ceil((queue.confirmationEndTime - Date.now()) / 1000));
	const minutes = Math.floor(timeLeft / 60);
	const seconds = timeLeft % 60;
	
	// Build mentions for all previous users
	const mentions = queue.previousUsers.map(pu => `<@${pu.userId}>`).join(" ");
	
	const embed = new EmbedBuilder()
		.setTitle("Queue Reopened - Confirm You're Still Active")
		.setDescription(`The ${region} queue has reopened! If you're still active, please click the button below within **${minutes}:${seconds.toString().padStart(2, '0')}** to keep your position in the queue.\n\n${mentions}`)
		.setColor(0xFFA500);
	
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`confirmActive_${region}`)
			.setLabel("Still Active")
			.setStyle(ButtonStyle.Success)
	);
	
	return { embed, components: [row] };
}

module.exports = {
	initialize,
	getQueue,
	getAllQueues,
	isQueueOpen,
	saveAllQueues,
	addUser,
	removeUser,
	getNextUser,
	removeNextUser,
	setTesterActive,
	setTesterInactive,
	openQueue,
	closeQueue,
	startConfirmationPeriod,
	confirmStillActive,
	processConfirmationPeriod,
	hasConfirmationPeriodEnded,
	buildQueueEmbed,
	buildQueueButtons,
	buildConfirmationMessage
};
