"use strict";

// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================

const path = require("path");
const { saveDataAtomic, loadDataAtomic } = require("./persistence-util");

// ============================================================================
// CONSTANTS
// ============================================================================

const DATA_FILE = path.join(__dirname, "tickets-data.json");

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Ticket data structure: { tickets: { ticketId: { ticketId, userId, testerId, region, preferredServer, channelId } } }
let ticketData = { tickets: {} };

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize ticket manager and load persisted data
 */
function initialize() {
	try {
		const data = loadDataAtomic(DATA_FILE);
		ticketData = data.tickets ? { tickets: data.tickets } : { tickets: {} };
		console.log(`Loaded ${Object.keys(ticketData.tickets).length} ticket(s) from persistence.`);
	} catch (error) {
		console.error("Error initializing ticket manager:", error.message);
		ticketData = { tickets: {} };
	}
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save ticket data to file
 */
function saveAllTickets() {
	try {
		saveDataAtomic(DATA_FILE, ticketData);
	} catch (error) {
		console.error("Error saving ticket data:", error.message);
	}
}

// ============================================================================
// TICKET MANAGEMENT
// ============================================================================

/**
 * Create a new ticket
 * @param {string} userId - User ID
 * @param {string} testerId - Tester ID
 * @param {string} region - Region (EU, NA, AS)
 * @param {string} preferredServer - Preferred server string
 * @param {string} channelId - Ticket channel ID
 * @returns {string} Ticket ID
 */
function createTicket(userId, testerId, region, preferredServer, channelId) {
	const ticketId = `ticket-${userId}-${Date.now()}`;
	
	ticketData.tickets[ticketId] = {
		ticketId,
		userId,
		testerId,
		region,
		preferredServer,
		channelId
	};
	
	saveAllTickets();
	return ticketId;
}

/**
 * Close/delete a ticket
 * @param {string} ticketId - Ticket ID
 * @returns {boolean} True if closed, false if not found
 */
function closeTicket(ticketId) {
	if (!ticketData.tickets[ticketId]) {
		return false;
	}
	
	delete ticketData.tickets[ticketId];
	saveAllTickets();
	return true;
}

/**
 * Get all tickets
 * @returns {Object} All tickets
 */
function getAllTickets() {
	return ticketData.tickets;
}

// ============================================================================
// TICKET GETTERS
// ============================================================================

/**
 * Get ticket by ID
 * @param {string} ticketId - Ticket ID
 * @returns {Object|null} Ticket data or null if not found
 */
function getTicket(ticketId) {
	return ticketData.tickets[ticketId] || null;
}

/**
 * Get ticket by channel ID
 * @param {string} channelId - Channel ID
 * @returns {Object|null} Ticket data or null if not found
 */
function getTicketByChannel(channelId) {
	for (const ticket of Object.values(ticketData.tickets)) {
		if (ticket.channelId === channelId) {
			return ticket;
		}
	}
	return null;
}

/**
 * Get ticket by user ID
 * @param {string} userId - User ID
 * @returns {Object|null} Ticket data or null if not found
 */
function getTicketByUser(userId) {
	for (const ticket of Object.values(ticketData.tickets)) {
		if (ticket.userId === userId) {
			return ticket;
		}
	}
	return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Clear all ticket data
 */
function clearAllData() {
	ticketData = { tickets: {} };
	saveAllTickets();
}

module.exports = {
	initialize,
	saveAllTickets,
	createTicket,
	getTicket,
	getTicketByChannel,
	getTicketByUser,
	closeTicket,
	getAllTickets,
	clearAllData
};
