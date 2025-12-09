# Bot Setup Guide

This guide will walk you through setting up the Discord Waitlist Queue Bot from scratch.

## Prerequisites

- Node.js (v16.9.0 or higher recommended)
- A Discord Bot Application (created on [Discord Developer Portal](https://discord.com/developers/applications))
- Administrator permissions in your Discord server

## Step 1: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and give it a name
3. Go to the **"Bot"** section in the left sidebar
4. Click **"Add Bot"** and confirm
5. Under **"Privileged Gateway Intents"**, enable:
   - ✅ **Server Members Intent** (required for role checking)
   - ✅ **Message Content Intent** (required for reading messages)
6. Copy the **Bot Token** (you'll need this later)
7. Go to the **"OAuth2" > "URL Generator"** section:
   - Select **"bot"** scope
   - Select **"applications.commands"** scope
   - Under **"Bot Permissions"**, select:
     - ✅ Manage Channels
     - ✅ View Channels
     - ✅ Send Messages
     - ✅ Embed Links
     - ✅ Read Message History
     - ✅ Use External Emojis
     - ✅ Manage Roles (optional, if you want the bot to manage roles)
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

## Step 2: Install Dependencies

1. Clone or download this repository
2. Open a terminal in the project directory
3. Install dependencies:
   ```bash
   npm install discord.js@14.14.1
   ```

## Step 3: Configure the Bot

1. Copy `config.example.json` to `config.json`:
   ```bash
   cp config.example.json config.json
   ```

2. Open `config.json` in a text editor

3. Fill in the required configuration:

   ```json
   {
     "token": "YOUR_BOT_TOKEN_HERE",
     "waitlistChannelId": "YOUR_WAITLIST_CHANNEL_ID",
     "queueChannels": {
       "EU": "YOUR_EU_QUEUE_CHANNEL_ID",
       "NA": "YOUR_NA_QUEUE_CHANNEL_ID",
       "AS": "YOUR_AS_QUEUE_CHANNEL_ID"
     },
     "testerRoleId": "YOUR_TESTER_ROLE_ID",
     "pingRoles": {
       "EU": "YOUR_EU_PING_ROLE_ID",
       "NA": "YOUR_NA_PING_ROLE_ID",
       "AS": "YOUR_AS_PING_ROLE_ID"
     },
     "maxQueueSize": 20,
     "confirmationGracePeriod": 5
   }
   ```

### Configuration Fields Explained

- **`token`**: Your Discord bot token (from Step 1)
- **`waitlistChannelId`**: The channel ID where the waitlist embed will appear
- **`queueChannels`**: Object containing channel IDs for each region's queue
  - **`EU`**: Channel ID for the EU queue
  - **`NA`**: Channel ID for the NA queue
  - **`AS`**: Channel ID for the AS queue
- **`testerRoleId`**: Role ID for testers (users who can use `/q join`)
- **`pingRoles`**: Object containing role IDs to ping when each region's queue opens
  - **`EU`**: Role ID for EU queue notifications (players get this role when joining EU waitlist)
  - **`NA`**: Role ID for NA queue notifications (players get this role when joining NA waitlist)
  - **`AS`**: Role ID for AS queue notifications (players get this role when joining AS waitlist)
  - **Note**: Players automatically receive the corresponding region role when they join the waitlist for that region
- **`maxQueueSize`**: Maximum number of players per queue (default: 20)
- **`confirmationGracePeriod`**: Grace period in minutes for confirmation (default: 5)
- **`waitlistCooldownDays`**: Cooldown period in days before players can rejoin waitlist after ticket submission (default: 30)

### How to Get Channel and Role IDs

1. **Enable Developer Mode** in Discord:
   - Go to User Settings > Advanced
   - Enable **"Developer Mode"**

2. **Get Channel ID**:
   - Right-click on a channel
   - Click **"Copy ID"**

3. **Get Role ID**:
   - Go to Server Settings > Roles
   - Right-click on a role
   - Click **"Copy ID"**

## Step 4: Create Required Channels and Roles

### Create Channels

1. **Waitlist Channel**:
   - Create a channel (e.g., `#waitlist`)
   - This is where users will join the waitlist
   - Copy the channel ID and add it to `config.json` as `waitlistChannelId`

2. **Queue Channels** (one for each region):
   - Create channels for each region (e.g., `#queue-eu`, `#queue-na`, `#queue-as`)
   - These channels will contain the queue embeds
   - Copy each channel ID and add them to `config.json` under `queueChannels`

### Create Roles

1. **Tester Role**:
   - Create a role (e.g., `Tester`)
   - This role allows users to use `/q join` and `/q leave`
   - Copy the role ID and add it to `config.json` as `testerRoleId`

2. **Region Ping Roles** (one for each region - required):
   - Create separate roles for each region (e.g., `EU Queue`, `NA Queue`, `AS Queue`)
   - These roles will be pinged when their respective queues open
   - **Important**: Players automatically receive the corresponding region role when they join the waitlist for that region
   - When a tester submits a ticket, the player's region role is automatically removed
   - Copy each role ID and add them to `config.json` under `pingRoles`

### Set Channel Permissions

For each **queue channel** (EU, NA, AS):
- Set default permissions so only users with the waitlist can see it
- The bot will automatically grant access when users join the waitlist

## Step 5: Start the Bot

1. Run the bot:
   ```bash
   node index.js
   ```

2. You should see:
   ```
   Config loaded successfully
   Loaded 0 waitlist user(s) from persistence.
   Loaded 0 queue(s) from persistence.
   Loaded 0 ticket(s) from persistence.
   Discord Waitlist Queue Bot is running.
   Commands registered for guild: YourServerName
   ```

3. If you see errors, check:
   - Is your bot token correct?
   - Are all channel IDs correct?
   - Are all role IDs correct?
   - Does the bot have the required permissions?

## Step 6: Initial Bot Setup (Using Commands)

Once the bot is running, use the `/setup` commands to configure it:

### 6.1 Set Waitlist Channel

1. Go to your waitlist channel
2. Run: `/setup waitlist channel:#waitlist`
3. The bot will create a waitlist embed with a "Join Waitlist" button
4. Changes are automatically saved to `config.json`

### 6.2 Set Queue Channels

For each region (EU, NA, AS):

1. Go to the queue channel for that region
2. Run: `/setup queue region:EU channel:#queue-eu` (replace EU with NA or AS as needed)
3. The bot will create a queue embed in that channel
4. Changes are automatically saved to `config.json`

### 6.3 Set Tester Role

1. Run: `/setup tester-role role:@Tester` (replace @Tester with your tester role)
2. Changes are automatically saved to `config.json`

### 6.4 Set Ping Roles

For each region (EU, NA, AS):

1. Run: `/setup ping-role region:EU role:@EU Queue` (replace EU with NA or AS, and @EU Queue with your region-specific role)
2. Changes are automatically saved to `config.json`
3. Repeat for each region (EU, NA, AS)
4. **Important**: Players automatically receive the corresponding region role when they join the waitlist for that region. This role is pinged when that region's queue opens.

### 6.5 Set Max Queue Size (Optional)

1. Run: `/setup max-size size:20` (adjust as needed, default is 20)
2. Changes are automatically saved to `config.json`

### 6.6 Set Grace Period (Optional)

1. Run: `/setup grace-period minutes:5` (adjust as needed, default is 5 minutes)
2. Changes are automatically saved to `config.json`

### 6.7 Set Waitlist Cooldown (Optional)

1. Run: `/setup waitlist-cooldown days:30` (adjust as needed, default is 30 days)
2. Changes are automatically saved to `config.json`
3. This sets how many days players must wait before rejoining the waitlist after a tester submits their ticket

## Step 8: Clear Bot Data (Admin Only)

If you need to reset the bot's data without losing your configuration, you can use the `/clear` commands:

### Clear Commands

- **`/clear all`**: Clears all temporary data (queues, waitlist, tickets, cooldowns)
  - This does NOT affect `config.json` - your configuration remains intact
  - Use this to completely reset the bot state
  
- **`/clear queues`**: Clears only queue data
  - Removes all players from queues, resets queue states
  
- **`/clear waitlist`**: Clears only waitlist data and cooldowns
  - Removes all users from waitlist and clears all cooldowns
  
- **`/clear tickets`**: Clears only ticket data
  - Removes all ticket records (note: this does not delete ticket channels, only the ticket records)

**Important**: These commands require Administrator permissions and permanently delete the specified data. Use with caution!

## Step 7: Verify Setup

1. **Check Waitlist Channel**:
   - You should see an embed with a "Join Waitlist" button
   - Click it to test (a modal should appear)

2. **Check Queue Channels**:
   - Each queue channel should have an embed showing the queue status
   - The queue should be in "Closed" state initially

3. **Test Tester Commands**:
   - As a user with the tester role, go to a queue channel
   - Run `/q join` - the queue should open
   - Run `/q leave` - the queue should close

## Troubleshooting

### Bot doesn't start

- **Error: "token is required"**: Check that `config.json` has a valid token
- **Error: "waitlistChannelId is required"**: Make sure all required fields are filled in `config.json`
- **Error: "Invalid token"**: Your bot token is incorrect or expired

### Commands don't appear

- Wait a few minutes for Discord to sync commands
- Try restarting the bot
- Make sure the bot has the `applications.commands` scope

### Embeds don't appear

- Check that the bot has permission to send messages and embeds in those channels
- Verify the channel IDs in `config.json` are correct
- Restart the bot after updating `config.json`

### Users can't join waitlist

- Check that the waitlist channel ID is correct
- Verify the bot has permission to send messages in that channel
- Make sure the waitlist embed exists (run `/setup waitlist` again if needed)

### Testers can't use `/q join`

- Verify the tester role ID is correct in `config.json`
- Make sure the user has the tester role
- Check that the command is being used in a queue channel (EU, NA, or AS)

## Next Steps

Once setup is complete:

1. **Assign Tester Roles**: Give the tester role to users who will be testing players
2. **Test the Workflow**: 
   - Have a user join the waitlist
   - Have a tester use `/q join` in a queue channel
   - Have the user join the queue
3. **Read the Workflow Guide**: See [WORKFLOW.md](WORKFLOW.md) for detailed information about how the system works

## Configuration File Example

Here's a complete example of a properly configured `config.json`:

```json
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "waitlistChannelId": "1234567890123456789",
  "queueChannels": {
    "EU": "9876543210987654321",
    "NA": "1122334455667788990",
    "AS": "9988776655443322110"
  },
  "testerRoleId": "1111222233334444555",
  "pingRoles": {
    "EU": "2222333344445555666",
    "NA": "3333444455556666777",
    "AS": "4444555566667777888"
  },
  "maxQueueSize": 20,
  "confirmationGracePeriod": 5,
  "waitlistCooldownDays": 30
}
```

## Important Notes

- **Always keep your bot token secret** - never share it or commit it to version control
- **Backup your data files**: The bot creates `waitlist-data.json`, `queue-data.json`, and `tickets-data.json` - back these up regularly
- **Automatic config saving**: The `/setup` commands automatically save changes to `config.json` - no manual editing needed
- **Restart after config changes**: Always restart the bot after modifying `config.json` manually

## Support

If you encounter issues not covered in this guide:

1. Check the console output for error messages
2. Verify all IDs are correct (channel IDs, role IDs)
3. Ensure the bot has all required permissions
4. Check that Node.js version is compatible (v16.9.0+)

