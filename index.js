"use strict";

// Dependencies
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

// Load config
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

// Rate limiting for button clicks
const buttonRateLimits = new Map();
const BUTTON_RATE_LIMIT_MS = 1000;

// Debounce for "Still Active" button (longer cooldown)
const confirmActiveDebounce = new Map();
const CONFIRM_ACTIVE_DEBOUNCE_MS = 5000; // 5 seconds

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

// Confirmation period timers
const confirmationTimers = new Map();

// Batch confirmation message updates (update every 3 seconds instead of on every click)
const confirmationUpdateQueues = new Map(); // region -> { needsUpdate: boolean, lastUpdate: number }
const CONFIRMATION_UPDATE_INTERVAL = 3000; // 3 seconds

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Graceful shutdown function
 */
async function gracefulShutdown() {
	if (isShuttingDown) return;
	isShuttingDown = true;
	
	console.log("\n🛑 Shutting down gracefully...");
	
	try {
		// Save all data (force save to flush any pending changes)
		queueManager.saveAllQueues(true); // Force save
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
		queueManager.saveAllQueues(true); // Force save
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
		queueManager.saveAllQueues(true); // Force save
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (saveError) {
		console.error("Error saving data on rejection:", saveError.message);
	}
});

process.on("exit", () => {
	try {
		queueManager.saveAllQueues(true); // Force save
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (error) {
		console.error("Error saving data on exit:", error.message);
	}
});

// Periodic backup saves (every 30 seconds) - also flushes any pending queue changes
setInterval(() => {
	try {
		queueManager.saveAllQueues(true); // Force save to flush pending changes
		waitlistManager.saveAllData();
		ticketManager.saveAllTickets();
	} catch (error) {
		console.error("Error in periodic backup save:", error.message);
	}
}, 30 * 1000);

// Check confirmation periods periodically
setInterval(() => {
	try {
		const regions = ["EU", "NA", "AS"];
		for (const region of regions) {
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
		const regions = ["EU", "NA", "AS"];
		for (const region of regions) {
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
 * Mark confirmation message as needing update (batched)
 */
function markConfirmationUpdateNeeded(region) {
	const updateInfo = confirmationUpdateQueues.get(region) || { needsUpdate: false, lastUpdate: 0 };
	updateInfo.needsUpdate = true;
	confirmationUpdateQueues.set(region, updateInfo);
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
		
		// Process the confirmation period
		queueManager.processConfirmationPeriod(region);
		
		// Get channel and delete confirmation message
		const channelId = config.queueChannels[region];
		if (channelId && queue.confirmationMessageId) {
			try {
				const channel = bot.channels.cache.get(channelId);
				if (channel) {
					const message = await channel.messages.fetch(queue.confirmationMessageId).catch(() => null);
					if (message) {
						await message.delete();
					}
				}
			} catch (error) {
				console.error(`Error deleting confirmation message for ${region}:`, error.message);
			}
		}
		
		// Update queue embed
		await updateQueueEmbed(region);
		
		// Ping role that queue is open
		try {
			const channelId = config.queueChannels[region];
			const channel = bot.channels.cache.get(channelId);
			if (channel && config.pingRoleId) {
				await channel.send(`<@&${config.pingRoleId}> The ${region} queue is now open!`);
			}
		} catch (error) {
			console.error(`Error pinging role for ${region}:`, error.message);
		}
	} catch (error) {
		console.error(`Error processing confirmation period for ${region}:`, error.message);
	}
}

/**
 * Update queue embed
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

// Bot ready event
bot.on("ready", async () => {
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
							description: "Set role to ping when queue opens",
							options: [
								{
									type: ApplicationCommandOptionType.Role,
									name: "role",
									description: "Role to ping",
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
				}
			]);
			console.log(`✓ Commands registered for guild: ${guild.name}`);
		}
		
		// Restore queue embeds on startup
		const regions = ["EU", "NA", "AS"];
		for (const region of regions) {
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

// Command handlers
bot.on("interactionCreate", async (interaction) => {
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
					config.waitlistChannelId = channel.id;
					// Note: In a real implementation, you'd save this to config.json
					await interaction.reply({ content: `Waitlist channel set to ${channel.name}. Please update config.json manually.`, ephemeral: true });
					await setupWaitlistEmbed();
				} else if (subcommand === "queue") {
					const region = interaction.options.getString("region");
					const channel = interaction.options.getChannel("channel");
					if (!config.queueChannels) {
						config.queueChannels = {};
					}
					config.queueChannels[region] = channel.id;
					// Note: In a real implementation, you'd save this to config.json
					
					// Create queue embed if it doesn't exist
					const queue = queueManager.getQueue(region);
					if (!queue.messageId) {
						const embed = queueManager.buildQueueEmbed(region);
						const buttons = queueManager.buildQueueButtons(region);
						const message = await channel.send({ embeds: [embed], components: buttons });
						queue.messageId = message.id;
						queueManager.saveAllQueues();
					}
					
					await interaction.reply({ content: `${region} queue channel set to ${channel.name}. Please update config.json manually.`, ephemeral: true });
				} else if (subcommand === "tester-role") {
					const role = interaction.options.getRole("role");
					config.testerRoleId = role.id;
					// Note: In a real implementation, you'd save this to config.json
					await interaction.reply({ content: `Tester role set to ${role.name}. Please update config.json manually.`, ephemeral: true });
				} else if (subcommand === "ping-role") {
					const role = interaction.options.getRole("role");
					config.pingRoleId = role.id;
					// Note: In a real implementation, you'd save this to config.json
					await interaction.reply({ content: `Ping role set to ${role.name}. Please update config.json manually.`, ephemeral: true });
				} else if (subcommand === "max-size") {
					const size = interaction.options.getInteger("size");
					config.maxQueueSize = size;
					// Note: In a real implementation, you'd save this to config.json
					await interaction.reply({ content: `Max queue size set to ${size}. Please update config.json manually.`, ephemeral: true });
				} else if (subcommand === "grace-period") {
					const minutes = interaction.options.getInteger("minutes");
					config.confirmationGracePeriod = minutes;
					// Note: In a real implementation, you'd save this to config.json
					await interaction.reply({ content: `Confirmation grace period set to ${minutes} minutes. Please update config.json manually.`, ephemeral: true });
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
					const regions = ["EU", "NA", "AS"];
					for (const r of regions) {
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
						// Ping role that queue is open
						const channel = bot.channels.cache.get(config.queueChannels[region]);
						if (channel && config.pingRoleId) {
							await channel.send(`<@&${config.pingRoleId}> The ${region} queue is now open!`);
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
					await updateQueueEmbed(region);
					await interaction.reply({ content: `You are no longer active as a tester for the ${region} queue.`, ephemeral: true });
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
	} else if (interaction.isButton()) {
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
			} else if (customId.startsWith("ticketCancel_") || customId.startsWith("ticketSubmit_")) {
				const ticketId = customId.split("_")[1];
				const ticket = ticketManager.getTicket(ticketId);
				
				if (!ticket) {
					return interaction.reply({ content: "Ticket not found.", ephemeral: true });
				}
				
				// Check if user is the tester or the player
				if (interaction.user.id !== ticket.testerId && interaction.user.id !== ticket.userId) {
					return interaction.reply({ content: "You don't have permission to close this ticket.", ephemeral: true });
				}
				
				// Delete channel
				try {
					const channel = bot.channels.cache.get(ticket.channelId);
					if (channel) {
						await channel.delete();
					}
				} catch (error) {
					console.error("Error deleting ticket channel:", error.message);
				}
				
				// Close ticket
				ticketManager.closeTicket(ticketId);
				await interaction.reply({ content: "Ticket closed.", ephemeral: true });
			}
		} catch (error) {
			console.error(`Error handling button ${customId}:`, error.message);
			try {
				await interaction.reply({ content: "An error occurred while processing your action.", ephemeral: true });
			} catch (replyError) {
				// Interaction may have already been replied to
			}
		}
	} else if (interaction.isModalSubmit()) {
		if (interaction.customId === "waitlistModal") {
			const region = interaction.fields.getTextInputValue("regionInput").toUpperCase().trim();
			const preferredServer = interaction.fields.getTextInputValue("serverInput").trim();
			
			// Validate region
			if (region !== "EU" && region !== "NA" && region !== "AS") {
				return interaction.reply({ content: "Invalid region. Please enter EU, NA, or AS.", ephemeral: true });
			}
			
			// Add to waitlist
			const added = waitlistManager.addToWaitlist(interaction.user.id, region, preferredServer);
			
			if (!added) {
				return interaction.reply({ content: "You are already in the waitlist.", ephemeral: true });
			}
			
			// Unlock region channel
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
			
			await interaction.reply({ content: `✅ You have joined the waitlist for ${region}! The ${region} queue channel has been unlocked for you.`, ephemeral: true });
		}
	}
});

// Update queue embeds periodically
setInterval(async () => {
	try {
		const regions = ["EU", "NA", "AS"];
		for (const region of regions) {
			await updateQueueEmbed(region);
		}
	} catch (error) {
		console.error("Error in queue update interval:", error.message);
	}
}, 10 * 1000); // Update every 10 seconds

// Handle when a player reaches position 1 - create ticket
setInterval(async () => {
	try {
		const regions = ["EU", "NA", "AS"];
		for (const region of regions) {
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
			
			// Get an active tester
			if (queue.activeTesters.length === 0) {
				continue; // No active testers
			}
			
			const testerId = queue.activeTesters[0]; // Use first active tester
			
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

// Error handling
bot.on("error", (error) => {
	console.error("Discord bot error:", error.message);
});

bot.on("warn", (warning) => {
	console.warn("Discord bot warning:", warning);
});

// Login
try {
	bot.login(config.token);
} catch (error) {
	console.error("Error logging in:", error.message);
	process.exit(1);
}
