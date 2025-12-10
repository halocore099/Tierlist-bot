"use strict";

// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================

const { 
	Client, 
	GatewayIntentBits, 
	EmbedBuilder,
	ApplicationCommandOptionType,
	PermissionFlagsBits,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} = require("discord.js");
const configManager = require("./configManager");
const waitlistManager = require("./waitlistManager");
const queueManager = require("./queueManager");
const ticketManager = require("./ticketManager");

// ============================================================================
// CONFIGURATION & INITIALIZATION
// ============================================================================

let config;
try {
	config = configManager.loadConfig();
} catch (error) {
	console.error("Error loading config:", error.message);
	process.exit(1);
}

const bot = new Client({ 
	intents: [
		GatewayIntentBits.Guilds, 
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent
	] 
});

// Initialize managers
waitlistManager.initialize();
queueManager.initialize();
ticketManager.initialize();

// ============================================================================
// CONSTANTS
// ============================================================================

const BUTTON_RATE_LIMIT_MS = 1000;
const CONFIRM_ACTIVE_DEBOUNCE_MS = 5000; // 5 seconds
const CONFIRMATION_UPDATE_INTERVAL = 3000; // 3 seconds
const REGIONS = ["EU", "NA", "AS"];

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Rate limiting
const buttonRateLimits = new Map();
const confirmActiveDebounce = new Map();

// Confirmation period management
const confirmationTimers = new Map();
const confirmationUpdateQueues = new Map(); // region -> { needsUpdate: boolean, lastUpdate: number }

// Shutdown flag
let isShuttingDown = false;

// ============================================================================
// RATE LIMITING FUNCTIONS
// ============================================================================

function isRateLimited(userId) {
	const lastClick = buttonRateLimits.get(userId);
	if (!lastClick) return false;
	return (Date.now() - lastClick) < BUTTON_RATE_LIMIT_MS;
}

function updateRateLimit(userId) {
	buttonRateLimits.set(userId, Date.now());
}

function isConfirmActiveDebounced(userId) {
	const lastClick = confirmActiveDebounce.get(userId);
	if (!lastClick) return false;
	return (Date.now() - lastClick) < CONFIRM_ACTIVE_DEBOUNCE_MS;
}

function updateConfirmActiveDebounce(userId) {
	confirmActiveDebounce.set(userId, Date.now());
}

/**
 * Safely delete a channel by ID, handling cases where the channel may not exist
 * @param {string} channelId - The channel ID to delete
 * @returns {Promise<boolean>} True if deleted successfully, false otherwise
 */
async function safeDeleteChannel(channelId) {
	try {
		let channel = bot.channels.cache.get(channelId);
		if (channel) {
			await channel.fetch();
			await channel.delete();
			return true;
		} else {
			const fetchedChannel = await bot.channels.fetch(channelId).catch(() => null);
			if (fetchedChannel) {
				await fetchedChannel.delete();
				return true;
			}
		}
	} catch (error) {
		console.warn(`Could not delete channel ${channelId}:`, error.message);
	}
	return false;
}

// ============================================================================
// QUEUE EMBED MANAGEMENT
// ============================================================================

/**
 * Update queue embed for a region
 */
async function updateQueueEmbed(region) {
	try {
		const queue = queueManager.getQueue(region);
		if (!queue) {
			return;
		}
		
		const channelId = config.queueChannels?.[region];
		if (!channelId) {
			return;
		}
		
		const channel = bot.channels.cache.get(channelId);
		if (!channel) {
			return;
		}
		
		const embed = queueManager.buildQueueEmbed(region);
		const buttons = queueManager.buildQueueButtons(region);
		
		if (queue.messageId) {
			// Try to update existing message
			const message = await channel.messages.fetch(queue.messageId).catch(() => null);
			if (message) {
				await message.edit({ embeds: [embed], components: buttons });
				return;
			}
			// Message was deleted, create new one
			queue.messageId = null;
		}
		
		// Create new message if it doesn't exist
		const message = await channel.send({ embeds: [embed], components: buttons });
		queue.messageId = message.id;
		queueManager.saveAllQueues();
	} catch (error) {
		console.error(`Error updating queue embed for ${region}:`, error.message);
	}
}

// ============================================================================
// CONFIRMATION PERIOD MANAGEMENT
// ============================================================================

/**
 * Mark confirmation message as needing update (batched)
 */
function markConfirmationUpdateNeeded(region) {
	const updateInfo = confirmationUpdateQueues.get(region) || { needsUpdate: false, lastUpdate: 0 };
	updateInfo.needsUpdate = true;
	confirmationUpdateQueues.set(region, updateInfo);
}

/**
 * Update confirmation message (batched)
 */
async function updateConfirmationMessage(region) {
	try {
		const queue = queueManager.getQueue(region);
		if (!queue || queue.state !== "confirmation_period" || !queue.confirmationMessageId) {
			return;
		}
		
		const channelId = config.queueChannels?.[region];
		if (!channelId) {
			return;
		}
		
		const channel = bot.channels.cache.get(channelId);
		if (!channel) {
			return;
		}
		
		const message = await channel.messages.fetch(queue.confirmationMessageId).catch(() => null);
		if (!message) {
			return;
		}
		
		const confirmationData = queueManager.buildConfirmationMessage(region);
		if (confirmationData) {
			await message.edit(confirmationData);
		}
	} catch (error) {
		console.error(`Error updating confirmation message for ${region}:`, error.message);
	}
}

/**
 * Process confirmation period end
 */
async function processConfirmationPeriod(region) {
	try {
		const queue = queueManager.getQueue(region);
		if (!queue || queue.state !== "confirmation_period") {
			return;
		}
		
		// Store confirmation message ID before processing (processConfirmationPeriod clears it)
		const confirmationMessageId = queue.confirmationMessageId;
		
		// Process the confirmation period
		queueManager.processConfirmationPeriod(region);
		
		// Get channel and delete confirmation message
		const channelId = config.queueChannels[region];
		const channel = bot.channels.cache.get(channelId);
		
		if (channel && confirmationMessageId) {
			try {
				const message = await channel.messages.fetch(confirmationMessageId).catch(() => null);
				if (message) {
					await message.delete();
				}
			} catch (error) {
				console.error(`Error deleting confirmation message for ${region}:`, error.message);
			}
		}
		
		// Get updated queue after processing
		const updatedQueue = queueManager.getQueue(region);
		
		// Update queue embed
		await updateQueueEmbed(region);
		
		// Ping region-specific role that queue is open and track the message
		try {
			if (channel && config.pingRoles && config.pingRoles[region]) {
				const pingMessage = await channel.send(`<@&${config.pingRoles[region]}> The ${region} queue is now open!`);
				// Track ping message for cleanup
				if (updatedQueue) {
					updatedQueue.pingMessageId = pingMessage.id;
					queueManager.saveAllQueues();
				}
			}
		} catch (error) {
			console.error(`Error pinging role for ${region}:`, error.message);
		}
	} catch (error) {
		console.error(`Error processing confirmation period for ${region}:`, error.message);
	}
}

// ============================================================================
// WAITLIST MANAGEMENT
// ============================================================================

/**
 * Setup waitlist embed
 */
async function setupWaitlistEmbed() {
	try {
		const channelId = config.waitlistChannelId;
		if (!channelId) {
			return;
		}
		
		const channel = bot.channels.cache.get(channelId);
		if (!channel) {
			console.error("Waitlist channel not found");
			return;
		}
		
		// Look for existing waitlist message
		const messages = await channel.messages.fetch({ limit: 10 });
		let waitlistMessage = messages.find(m => 
			m.author.id === bot.user.id && 
			m.embeds.length > 0 && 
			m.embeds[0].title && 
			m.embeds[0].title.includes("Waitlist")
		);
		
		const embed = new EmbedBuilder()
			.setTitle("Join Waitlist")
			.setDescription("Click the button below to join the waitlist and unlock your region queue channel.")
			.setColor(0x0099FF);
		
		const button = new ButtonBuilder()
			.setCustomId("joinWaitlist")
			.setLabel("Join Waitlist")
			.setStyle(ButtonStyle.Primary);
		
		const row = new ActionRowBuilder().addComponents(button);
		
		if (waitlistMessage) {
			await waitlistMessage.edit({ embeds: [embed], components: [row] });
		} else {
			await channel.send({ embeds: [embed], components: [row] });
		}
	} catch (error) {
		console.error("Error setting up waitlist embed:", error.message);
	}
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Graceful shutdown function
 */
async function gracefulShutdown() {
	if (isShuttingDown) return;
	isShuttingDown = true;
	
	console.log("\n🛑 Shutting down gracefully...");
	
	try {
		// Save all data (force save to flush any pending changes)
		queueManager.saveAllQueues(true);
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
		console.log("✓ All data saved successfully.");
	} catch (error) {
		console.error("Error saving data on shutdown:", error.message);
	}
	
	try {
		bot.destroy();
		console.log("✓ Discord client disconnected.");
	} catch (error) {
		console.error("Error disconnecting Discord client:", error.message);
	}
	
	process.exit(0);
}

// Register shutdown handlers
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	try {
		queueManager.saveAllQueues(true);
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (saveError) {
		console.error("Error saving data on exception:", saveError.message);
	}
	gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	try {
		queueManager.saveAllQueues(true);
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (saveError) {
		console.error("Error saving data on rejection:", saveError.message);
	}
});

process.on("exit", () => {
	try {
		queueManager.saveAllQueues(true);
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (error) {
		console.error("Error saving data on exit:", error.message);
	}
});

// ============================================================================
// PERIODIC TASKS
// ============================================================================

// Periodic backup saves (every 30 seconds) - also flushes any pending queue changes
setInterval(() => {
	try {
		queueManager.saveAllQueues(true);
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (error) {
		console.error("Error in periodic backup save:", error.message);
	}
}, 30 * 1000);

// Cleanup stale rate limit entries (every 5 minutes) - prevents memory leak
setInterval(() => {
	try {
		const now = Date.now();
		const rateLimitExpiry = BUTTON_RATE_LIMIT_MS * 10; // 10 seconds
		const debounceExpiry = CONFIRM_ACTIVE_DEBOUNCE_MS * 10; // 50 seconds

		for (const [userId, time] of buttonRateLimits.entries()) {
			if (now - time > rateLimitExpiry) {
				buttonRateLimits.delete(userId);
			}
		}

		for (const [userId, time] of confirmActiveDebounce.entries()) {
			if (now - time > debounceExpiry) {
				confirmActiveDebounce.delete(userId);
			}
		}
	} catch (error) {
		console.error("Error cleaning up rate limit maps:", error.message);
	}
}, 5 * 60 * 1000);

// Check confirmation periods periodically
setInterval(() => {
	try {
		for (const region of REGIONS) {
			if (queueManager.hasConfirmationPeriodEnded(region)) {
				processConfirmationPeriod(region);
			}
		}
	} catch (error) {
		console.error("Error checking confirmation periods:", error.message);
	}
}, 1000); // Check every second

// Batch update confirmation messages
setInterval(async () => {
	try {
		for (const region of REGIONS) {
			const updateInfo = confirmationUpdateQueues.get(region);
			if (updateInfo && updateInfo.needsUpdate) {
				const now = Date.now();
				if (now - updateInfo.lastUpdate >= CONFIRMATION_UPDATE_INTERVAL) {
					await updateConfirmationMessage(region);
					updateInfo.needsUpdate = false;
					updateInfo.lastUpdate = now;
				}
			}
		}
	} catch (error) {
		console.error("Error in confirmation message batch update:", error.message);
	}
}, 1000); // Check every second

// Update queue embeds periodically
setInterval(async () => {
	try {
		for (const region of REGIONS) {
			await updateQueueEmbed(region);
		}
	} catch (error) {
		console.error("Error in queue update interval:", error.message);
	}
}, 10 * 1000); // Update every 10 seconds

// Handle when a player reaches position 1 - create ticket
setInterval(async () => {
	try {
		for (const region of REGIONS) {
			const queue = queueManager.getQueue(region);
			if (queue.state !== "open" || queue.users.length === 0) {
				continue;
			}
			
			// Check if there's a user at position 1
			const nextUser = queueManager.getNextUser(region);
			if (!nextUser) {
				continue;
			}
			
			// Check if ticket already exists for this user
			const existingTicket = ticketManager.getTicketByUser(nextUser.userId);
			if (existingTicket) {
				continue; // Ticket already exists
			}
			
			// Get user data from waitlist
			const userData = waitlistManager.getUserData(nextUser.userId);
			if (!userData) {
				continue; // User not in waitlist (shouldn't happen, but handle gracefully)
			}
			
			// Get an active tester using round-robin assignment
			const testerId = queueManager.getNextTesterRoundRobin(region);
			if (!testerId) {
				continue; // No active testers
			}
			
			// Remove user from queue
			queueManager.removeNextUser(region);
			
			// Create ticket channel
			try {
				const channelId = config.queueChannels[region];
				const queueChannel = bot.channels.cache.get(channelId);
				if (!queueChannel) {
					continue;
				}
				
				const guild = queueChannel.guild;
				const category = queueChannel.parent;
				
				// Create private channel
				const ticketChannel = await guild.channels.create({
					name: `ticket-${nextUser.userId}`,
					type: 0, // Text channel
					parent: category ? category.id : null,
					permissionOverwrites: [
						{
							id: guild.id,
							deny: [PermissionFlagsBits.ViewChannel]
						},
						{
							id: nextUser.userId,
							allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
						},
						{
							id: config.testerRoleId,
							allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
						}
					]
				});
				
				// Create ticket
				const ticketId = ticketManager.createTicket(
					nextUser.userId,
					testerId,
					region,
					userData.preferredServer,
					ticketChannel.id
				);
				
				// Send ticket embed
				const embed = new EmbedBuilder()
					.setTitle("Testing Session")
					.addFields(
						{ name: "Player", value: `<@${nextUser.userId}>`, inline: true },
						{ name: "Region", value: region, inline: true },
						{ name: "Preferred Server", value: userData.preferredServer, inline: true },
						{ name: "Tester", value: `<@${testerId}>`, inline: true }
					)
					.setColor(0x0099FF);
				
				const cancelButton = new ButtonBuilder()
					.setCustomId(`ticketCancel_${ticketId}`)
					.setLabel("Cancel")
					.setStyle(ButtonStyle.Danger);
				
				const submitButton = new ButtonBuilder()
					.setCustomId(`ticketSubmit_${ticketId}`)
					.setLabel("Submit")
					.setStyle(ButtonStyle.Success);
				
				const row = new ActionRowBuilder().addComponents(cancelButton, submitButton);
				
				await ticketChannel.send({ embeds: [embed], components: [row] });
				await ticketChannel.send(`<@${nextUser.userId}> <@${testerId}> Testing session started.`);
				
				// Update queue embed
				await updateQueueEmbed(region);
			} catch (error) {
				console.error(`Error creating ticket for ${nextUser.userId}:`, error.message);
			}
		}
	} catch (error) {
		console.error("Error in ticket creation interval:", error.message);
	}
}, 5 * 1000); // Check every 5 seconds

// ============================================================================
// DISCORD EVENT HANDLERS
// ============================================================================

// Bot ready event
bot.on("clientReady", async () => {
	console.log("Discord Waitlist Queue Bot is running.");
	
	try {
		// Register commands for all guilds
		for (const [guildId, guild] of bot.guilds.cache) {
			await guild.commands.set([
				{
					name: "setup",
					description: "Setup bot configuration (admin only)",
					options: [
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "waitlist",
							description: "Set waitlist channel",
							options: [
								{
									type: ApplicationCommandOptionType.Channel,
									name: "channel",
									description: "Channel for waitlist",
									required: true
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "queue",
							description: "Set queue channel for a region",
							options: [
								{
									type: ApplicationCommandOptionType.String,
									name: "region",
									description: "Region (EU, NA, AS)",
									required: true,
									choices: [
										{ name: "EU", value: "EU" },
										{ name: "NA", value: "NA" },
										{ name: "AS", value: "AS" }
									]
								},
								{
									type: ApplicationCommandOptionType.Channel,
									name: "channel",
									description: "Channel for queue",
									required: true
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "tester-role",
							description: "Set tester role",
							options: [
								{
									type: ApplicationCommandOptionType.Role,
									name: "role",
									description: "Tester role",
									required: true
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "ping-role",
							description: "Set role to ping when queue opens for a region",
							options: [
								{
									type: ApplicationCommandOptionType.String,
									name: "region",
									description: "Region (EU, NA, AS)",
									required: true,
									choices: [
										{ name: "EU", value: "EU" },
										{ name: "NA", value: "NA" },
										{ name: "AS", value: "AS" }
									]
								},
								{
									type: ApplicationCommandOptionType.Role,
									name: "role",
									description: "Role to ping for this region",
									required: true
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "max-size",
							description: "Set max queue size",
							options: [
								{
									type: ApplicationCommandOptionType.Integer,
									name: "size",
									description: "Max queue size",
									required: true,
									min_value: 1,
									max_value: 100
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "grace-period",
							description: "Set confirmation grace period in minutes",
							options: [
								{
									type: ApplicationCommandOptionType.Integer,
									name: "minutes",
									description: "Grace period in minutes",
									required: true,
									min_value: 1,
									max_value: 60
								}
							]
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "waitlist-cooldown",
							description: "Set waitlist cooldown period in days",
							options: [
								{
									type: ApplicationCommandOptionType.Integer,
									name: "days",
									description: "Cooldown period in days",
									required: true,
									min_value: 1,
									max_value: 365
								}
							]
						}
					]
				},
				{
					name: "q",
					description: "Queue commands",
					options: [
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "join",
							description: "Join as active tester (opens queue if closed)"
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "leave",
							description: "Leave as tester (closes queue if last tester)"
						}
					]
				},
				{
					name: "clear",
					description: "Clear bot data (admin only)",
					options: [
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "all",
							description: "Clear all data (queues, waitlist, tickets, cooldowns)"
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "queues",
							description: "Clear all queue data"
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "waitlist",
							description: "Clear all waitlist data and cooldowns"
						},
						{
							type: ApplicationCommandOptionType.Subcommand,
							name: "tickets",
							description: "Clear all ticket data"
						}
					]
				}
			]);
			console.log(`✓ Commands registered for guild: ${guild.name}`);
		}
		
		// Restore queue embeds on startup
		for (const region of REGIONS) {
			const queue = queueManager.getQueue(region);
			const channelId = config.queueChannels?.[region];
			
			if (channelId) {
				const channel = bot.channels.cache.get(channelId);
				if (channel) {
					if (queue.messageId) {
						// Try to restore existing message
						try {
							const message = await channel.messages.fetch(queue.messageId).catch(() => null);
							if (message) {
								await updateQueueEmbed(region);
							} else {
								// Message was deleted, create new one
								const embed = queueManager.buildQueueEmbed(region);
								const buttons = queueManager.buildQueueButtons(region);
								const newMessage = await channel.send({ embeds: [embed], components: buttons });
								queue.messageId = newMessage.id;
								queueManager.saveAllQueues();
							}
						} catch (error) {
							console.error(`Error restoring queue embed for ${region}:`, error.message);
						}
					} else {
						// No message ID, create new embed
						const embed = queueManager.buildQueueEmbed(region);
						const buttons = queueManager.buildQueueButtons(region);
						const message = await channel.send({ embeds: [embed], components: buttons });
						queue.messageId = message.id;
						queueManager.saveAllQueues();
					}
					
					// Check if confirmation period is active and resume timer
					if (queue.state === "confirmation_period" && queue.confirmationEndTime) {
						const timeRemaining = queue.confirmationEndTime - Date.now();
						if (timeRemaining > 0) {
							console.log(`Resuming confirmation period for ${region} (${Math.ceil(timeRemaining / 1000)}s remaining)`);
							
							// Restore confirmation message if it exists
							if (queue.confirmationMessageId) {
								try {
									const confirmationMessage = await channel.messages.fetch(queue.confirmationMessageId).catch(() => null);
									if (!confirmationMessage) {
										// Message was deleted, recreate it
										const confirmationData = queueManager.buildConfirmationMessage(region);
										if (confirmationData) {
											const newMessage = await channel.send(confirmationData);
											queue.confirmationMessageId = newMessage.id;
											queueManager.saveAllQueues();
										}
									}
								} catch (error) {
									console.error(`Error restoring confirmation message for ${region}:`, error.message);
								}
							} else {
								// Create confirmation message if it doesn't exist
								const confirmationData = queueManager.buildConfirmationMessage(region);
								if (confirmationData) {
									const message = await channel.send(confirmationData);
									queue.confirmationMessageId = message.id;
									queueManager.saveAllQueues();
								}
							}
						} else {
							// Confirmation period should have ended, process it
							console.log(`Confirmation period for ${region} expired while bot was offline, processing now...`);
							await processConfirmationPeriod(region);
						}
					}
				}
			}
		}
		
		// Create/update waitlist embed
		await setupWaitlistEmbed();
	} catch (error) {
		console.error("Error setting up bot:", error.message);
	}
});

// Interaction handlers
bot.on("interactionCreate", async (interaction) => {
	// Command handlers
	if (interaction.isCommand()) {
		const { commandName } = interaction;
		
		try {
			if (commandName === "setup") {
				if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
					return interaction.reply({ content: "You do not have the required permissions.", ephemeral: true });
				}
				
				const subcommand = interaction.options.getSubcommand();
				
				if (subcommand === "waitlist") {
					const channel = interaction.options.getChannel("channel");
					const saved = configManager.updateConfig("waitlistChannelId", channel.id);
					if (saved) {
						config.waitlistChannelId = channel.id;
						await setupWaitlistEmbed();
						await interaction.reply({ content: `✅ Waitlist channel set to ${channel.name} and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ Waitlist channel set to ${channel.name}, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "queue") {
					const region = interaction.options.getString("region");
					const channel = interaction.options.getChannel("channel");
					const configKey = `queueChannels.${region}`;
					const saved = configManager.updateConfig(configKey, channel.id);
					if (saved) {
						if (!config.queueChannels) {
							config.queueChannels = {};
						}
						config.queueChannels[region] = channel.id;
						
						// Create queue embed if it doesn't exist
						const queue = queueManager.getQueue(region);
						if (!queue.messageId) {
							const embed = queueManager.buildQueueEmbed(region);
							const buttons = queueManager.buildQueueButtons(region);
							const message = await channel.send({ embeds: [embed], components: buttons });
							queue.messageId = message.id;
							queueManager.saveAllQueues();
						}
						
						await interaction.reply({ content: `✅ ${region} queue channel set to ${channel.name} and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ ${region} queue channel set to ${channel.name}, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "tester-role") {
					const role = interaction.options.getRole("role");
					const saved = configManager.updateConfig("testerRoleId", role.id);
					if (saved) {
						config.testerRoleId = role.id;
						await interaction.reply({ content: `✅ Tester role set to ${role.name} and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ Tester role set to ${role.name}, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "ping-role") {
					const region = interaction.options.getString("region");
					const role = interaction.options.getRole("role");
					const configKey = `pingRoles.${region}`;
					const saved = configManager.updateConfig(configKey, role.id);
					if (saved) {
						if (!config.pingRoles) {
							config.pingRoles = {};
						}
						config.pingRoles[region] = role.id;
						await interaction.reply({ content: `✅ ${region} ping role set to ${role.name} and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ ${region} ping role set to ${role.name}, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "max-size") {
					const size = interaction.options.getInteger("size");
					const saved = configManager.updateConfig("maxQueueSize", size);
					if (saved) {
						config.maxQueueSize = size;
						await interaction.reply({ content: `✅ Max queue size set to ${size} and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ Max queue size set to ${size}, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "grace-period") {
					const minutes = interaction.options.getInteger("minutes");
					const saved = configManager.updateConfig("confirmationGracePeriod", minutes);
					if (saved) {
						config.confirmationGracePeriod = minutes;
						await interaction.reply({ content: `✅ Confirmation grace period set to ${minutes} minutes and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ Confirmation grace period set to ${minutes} minutes, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				} else if (subcommand === "waitlist-cooldown") {
					const days = interaction.options.getInteger("days");
					const saved = configManager.updateConfig("waitlistCooldownDays", days);
					if (saved) {
						config.waitlistCooldownDays = days;
						await interaction.reply({ content: `✅ Waitlist cooldown set to ${days} days and saved to config.json.`, ephemeral: true });
					} else {
						await interaction.reply({ content: `⚠️ Waitlist cooldown set to ${days} days, but failed to save to config.json. Please update it manually.`, ephemeral: true });
					}
				}
			} else if (commandName === "q") {
				const subcommand = interaction.options.getSubcommand();
				const region = interaction.channel.id === config.queueChannels?.EU ? "EU" :
				              interaction.channel.id === config.queueChannels?.NA ? "NA" :
				              interaction.channel.id === config.queueChannels?.AS ? "AS" : null;
				
				if (!region) {
					return interaction.reply({ content: "This command can only be used in a queue channel.", ephemeral: true });
				}
				
				if (subcommand === "join") {
					// Check if user has tester role
					if (!interaction.member.roles.cache.has(config.testerRoleId)) {
						return interaction.reply({ content: "You do not have the required tester role.", ephemeral: true });
					}
					
					// Tester conflict prevention
					const hasTesterRole = interaction.member.roles.cache.has(config.testerRoleId);
					
					// Remove from waitlist (preserve permissions if tester)
					const removedWaitlistData = waitlistManager.removeFromWaitlist(interaction.user.id, hasTesterRole);
					
					// Remove from all queues as a player
					for (const r of REGIONS) {
						queueManager.removeUser(r, interaction.user.id);
					}
					
					// Set tester as active
					queueManager.setTesterActive(region, interaction.user.id);
					
					// If queue was closed and has previous users, start confirmation period
					const queue = queueManager.getQueue(region);
					if (queue.state === "confirmation_period") {
						// Send confirmation message
						const confirmationData = queueManager.buildConfirmationMessage(region);
						if (confirmationData) {
							const channel = bot.channels.cache.get(config.queueChannels[region]);
							if (channel) {
								const message = await channel.send(confirmationData);
								queue.confirmationMessageId = message.id;
								queueManager.saveAllQueues();
							}
						}
					} else if (queue.state === "open") {
						// Ping region-specific role that queue is open and track the message
						const channel = bot.channels.cache.get(config.queueChannels[region]);
						if (channel && config.pingRoles && config.pingRoles[region]) {
							const pingMessage = await channel.send(`<@&${config.pingRoles[region]}> The ${region} queue is now open!`);
							// Track ping message for cleanup
							queue.pingMessageId = pingMessage.id;
							queueManager.saveAllQueues();
						}
					}
					
					await updateQueueEmbed(region);
					await interaction.reply({ content: `You are now active as a tester for the ${region} queue.`, ephemeral: true });
				} else if (subcommand === "leave") {
					// Check if user has tester role
					if (!interaction.member.roles.cache.has(config.testerRoleId)) {
						return interaction.reply({ content: "You do not have the required tester role.", ephemeral: true });
					}
					
					queueManager.setTesterInactive(region, interaction.user.id);
					
					// Delete ping message if queue closed
					const queue = queueManager.getQueue(region);
					if (queue && queue.state === "closed" && queue.pingMessageId) {
						try {
							const channel = bot.channels.cache.get(config.queueChannels[region]);
							if (channel) {
								const pingMessage = await channel.messages.fetch(queue.pingMessageId).catch(() => null);
								if (pingMessage) {
									await pingMessage.delete();
								}
							}
							queue.pingMessageId = null;
							queueManager.saveAllQueues();
						} catch (error) {
							console.error(`Error deleting ping message for ${region}:`, error.message);
						}
					}
					
					// Delete confirmation message if queue closed
					if (queue && queue.state === "closed" && queue.confirmationMessageId) {
						try {
							const channel = bot.channels.cache.get(config.queueChannels[region]);
							if (channel) {
								const confirmationMessage = await channel.messages.fetch(queue.confirmationMessageId).catch(() => null);
								if (confirmationMessage) {
									await confirmationMessage.delete();
								}
							}
							queue.confirmationMessageId = null;
							queueManager.saveAllQueues();
						} catch (error) {
							console.error(`Error deleting confirmation message for ${region}:`, error.message);
						}
					}
					
					await updateQueueEmbed(region);
					await interaction.reply({ content: `You are no longer active as a tester for the ${region} queue.`, ephemeral: true });
				}
			} else if (commandName === "clear") {
				if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
					return interaction.reply({ content: "You do not have the required permissions.", ephemeral: true });
				}
				
				const subcommand = interaction.options.getSubcommand();
				
				if (subcommand === "all") {
					// Clear everything
					queueManager.clearAllData();
					waitlistManager.clearAllData();
					ticketManager.clearAllData();
					await interaction.reply({ content: "All data has been cleared (queues, waitlist, tickets, and cooldowns). Configuration remains unchanged.", ephemeral: true });
				} else if (subcommand === "queues") {
					queueManager.clearAllData();
					await interaction.reply({ content: "All queue data has been cleared.", ephemeral: true });
				} else if (subcommand === "waitlist") {
					waitlistManager.clearAllData();
					await interaction.reply({ content: "All waitlist data and cooldowns have been cleared.", ephemeral: true });
				} else if (subcommand === "tickets") {
					ticketManager.clearAllData();
					await interaction.reply({ content: "All ticket data has been cleared.", ephemeral: true });
				}
			}
		} catch (error) {
			console.error(`Error handling command ${commandName}:`, error.message);
			try {
				await interaction.reply({ content: "An error occurred while processing your command.", ephemeral: true });
			} catch (replyError) {
				// Interaction may have already been replied to
			}
		}
	}
	
	// Button handlers
	else if (interaction.isButton()) {
		// Rate limiting
		if (isRateLimited(interaction.user.id)) {
			return interaction.reply({ content: "⏳ Please wait a moment before clicking again.", ephemeral: true });
		}
		updateRateLimit(interaction.user.id);
		
		const customId = interaction.customId;
		
		try {
			if (customId === "joinWaitlist") {
				// Show modal for waitlist registration
				const modal = new ModalBuilder()
					.setCustomId("waitlistModal")
					.setTitle("Join Waitlist");
				
				const regionInput = new TextInputBuilder()
					.setCustomId("regionInput")
					.setLabel("Region")
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("EU, NA, or AS")
					.setRequired(true)
					.setMaxLength(2);
				
				const serverInput = new TextInputBuilder()
					.setCustomId("serverInput")
					.setLabel("Preferred Server")
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("Enter your preferred server")
					.setRequired(true)
					.setMaxLength(100);
				
				const regionRow = new ActionRowBuilder().addComponents(regionInput);
				const serverRow = new ActionRowBuilder().addComponents(serverInput);
				
				modal.addComponents(regionRow, serverRow);
				await interaction.showModal(modal);
			} else if (customId.startsWith("joinQueue_")) {
				const region = customId.split("_")[1];
				
				// Prevent testers from joining as players
				if (interaction.member.roles.cache.has(config.testerRoleId)) {
					return interaction.reply({ content: "Testers cannot join queues as players. Use `/q join` to activate as a tester instead.", ephemeral: true });
				}
				
				// Check if user is an active tester in this region
				const queue = queueManager.getQueue(region);
				if (queue && queue.activeTesters.includes(interaction.user.id)) {
					return interaction.reply({ content: "You are currently an active tester and cannot join the queue as a player.", ephemeral: true });
				}
				
				const added = queueManager.addUser(region, interaction.user.id);
				
				if (added) {
					await updateQueueEmbed(region);
					await interaction.reply({ content: "You have successfully joined the queue.", ephemeral: true });
				} else {
					await interaction.reply({ content: "You are already in the queue, or the queue is full/closed.", ephemeral: true });
				}
			} else if (customId.startsWith("confirmActive_")) {
				const region = customId.split("_")[1];
				
				// Check debounce
				if (isConfirmActiveDebounced(interaction.user.id)) {
					return interaction.reply({ content: "⏳ Please wait a moment before confirming again.", ephemeral: true });
				}
				
				const confirmed = queueManager.confirmStillActive(region, interaction.user.id);
				
				if (confirmed) {
					updateConfirmActiveDebounce(interaction.user.id);
					await updateQueueEmbed(region);
					// Mark confirmation message as needing update (batched)
					markConfirmationUpdateNeeded(region);
					await interaction.reply({ content: "✅ You have confirmed you're still active! Your position will be retained.", ephemeral: true });
				} else {
					await interaction.reply({ content: "⚠️ You were not in the previous queue, or you have already confirmed.", ephemeral: true });
				}
			} else if (customId.startsWith("ticketCancel_")) {
				const ticketId = customId.split("_")[1];
				const ticket = ticketManager.getTicket(ticketId);
				
				if (!ticket) {
					return interaction.reply({ content: "Ticket not found.", ephemeral: true });
				}
				
				// Permission check: Only the tester or the player can cancel the ticket
				if (interaction.user.id !== ticket.testerId && interaction.user.id !== ticket.userId) {
					return interaction.reply({ content: "You don't have permission to cancel this ticket. Only the tester or player can cancel it.", ephemeral: true });
				}
				
				// Delete ticket channel and close ticket
				await safeDeleteChannel(ticket.channelId);
				ticketManager.closeTicket(ticketId);
				await interaction.reply({ content: "Ticket cancelled.", ephemeral: true });
			} else if (customId.startsWith("ticketSubmit_")) {
				const ticketId = customId.split("_")[1];
				const ticket = ticketManager.getTicket(ticketId);
				
				if (!ticket) {
					return interaction.reply({ content: "Ticket not found.", ephemeral: true });
				}
				
				// Submit button: Only testers can press this
				if (interaction.user.id !== ticket.testerId) {
					return interaction.reply({ content: "Only the tester can submit this ticket.", ephemeral: true });
				}
				
				// Remove player from waitlist and revoke channel permissions
				const playerUserId = ticket.userId;
				const removedUserData = waitlistManager.removeFromWaitlist(playerUserId, false);
				
				if (removedUserData) {
					// Revoke channel permissions for all unlocked channels
					if (removedUserData.unlockedChannels) {
						for (const unlockedChannelId of removedUserData.unlockedChannels) {
							try {
								const unlockedChannel = bot.channels.cache.get(unlockedChannelId);
								if (unlockedChannel) {
									await unlockedChannel.permissionOverwrites.delete(playerUserId);
								}
							} catch (error) {
								console.error(`Error revoking channel permissions for ${playerUserId} in ${unlockedChannelId}:`, error.message);
							}
						}
					}
					
					// Remove region-specific ping role
					if (removedUserData.region && config.pingRoles && config.pingRoles[removedUserData.region]) {
						try {
							const guild = interaction.guild;
							const member = await guild.members.fetch(playerUserId).catch(() => null);
							if (member) {
								const role = guild.roles.cache.get(config.pingRoles[removedUserData.region]);
								if (role) {
									await member.roles.remove(role);
								}
							}
						} catch (error) {
							console.error(`Error removing ${removedUserData.region} ping role:`, error.message);
						}
					}
				}
				
				// Set cooldown for the player
				const cooldownDays = config.waitlistCooldownDays || 30;
				waitlistManager.setCooldown(playerUserId, cooldownDays);
				
				// Delete ticket channel and close ticket
				await safeDeleteChannel(ticket.channelId);
				ticketManager.closeTicket(ticketId);
				await interaction.reply({ content: `Ticket submitted. Player has been removed from waitlist and will be on cooldown for ${cooldownDays} days.`, ephemeral: true });
			}
		} catch (error) {
			console.error(`Error handling button ${customId}:`, error.message);
			try {
				await interaction.reply({ content: "An error occurred while processing your action.", ephemeral: true });
			} catch (replyError) {
				// Interaction may have already been replied to
			}
		}
	}
	
	// Modal handlers
	else if (interaction.isModalSubmit()) {
		if (interaction.customId === "waitlistModal") {
			const region = interaction.fields.getTextInputValue("regionInput").toUpperCase().trim();
			const preferredServer = interaction.fields.getTextInputValue("serverInput").trim();
			
			// Validate region
			if (region !== "EU" && region !== "NA" && region !== "AS") {
				return interaction.reply({ content: "Invalid region. Please enter EU, NA, or AS.", ephemeral: true });
			}
			
			// Add to waitlist (with cooldown check)
			const cooldownDays = config.waitlistCooldownDays || 30;
			const result = waitlistManager.addToWaitlist(interaction.user.id, region, preferredServer, cooldownDays);
			
			if (!result.success) {
				if (result.reason === "already_in_waitlist") {
					return interaction.reply({ content: "You are already in the waitlist.", ephemeral: true });
				} else if (result.reason === "cooldown") {
					return interaction.reply({ content: `You are on cooldown. You can join the waitlist again in ${result.daysRemaining} day(s).`, ephemeral: true });
				}
				return interaction.reply({ content: "Unable to join waitlist. Please try again later.", ephemeral: true });
			}
			
			// Unlock region channel and assign region role
			const channelId = config.queueChannels[region];
			if (channelId) {
				try {
					const channel = bot.channels.cache.get(channelId);
					if (channel) {
						await channel.permissionOverwrites.create(interaction.user.id, {
							ViewChannel: true
						});
						waitlistManager.unlockRegionChannel(interaction.user.id, channelId);
					}
				} catch (error) {
					console.error(`Error unlocking channel for ${region}:`, error.message);
				}
			}
			
			// Assign region-specific ping role
			if (config.pingRoles && config.pingRoles[region]) {
				try {
					const guild = interaction.guild;
					const role = guild.roles.cache.get(config.pingRoles[region]);
					if (role) {
						await interaction.member.roles.add(role);
					}
				} catch (error) {
					console.error(`Error assigning ${region} ping role:`, error.message);
				}
			}
			
			await interaction.reply({ content: `✅ You have joined the waitlist for ${region}! The ${region} queue channel has been unlocked for you and you've been assigned the ${region} queue role.`, ephemeral: true });
		}
	}
});

// Error handling
bot.on("error", (error) => {
	console.error("Discord bot error:", error.message);
});

bot.on("warn", (warning) => {
	console.warn("Discord bot warning:", warning);
});

// ============================================================================
// BOT LOGIN
// ============================================================================

try {
	bot.login(config.token);
} catch (error) {
	console.error("Error logging in:", error.message);
	process.exit(1);
}
