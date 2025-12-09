# Discord Waitlist Queue Bot

A Discord bot for managing region-based testing queues with a waitlist system. Players join a waitlist, unlock their region queue channel, and can join queues when testers are active.

## Features

- **Waitlist System**: Players join a waitlist with modal registration, region selection, and preferred server info
- **Region-Based Queues**: Separate queues for EU, NA, and AS regions
- **Automatic Channel Unlocking**: Players unlock their region queue channel after joining the waitlist
- **Automatic Role Assignment**: Players automatically receive the region-specific ping role when joining the waitlist (e.g., @EU Queue, @NA Queue, @AS Queue)
- **Waitlist Cooldown System**: Players who complete testing are placed on cooldown before they can rejoin the waitlist (configurable, default 30 days)
- **Tester Management**: Testers can activate/deactivate queues using `/q join` and `/q leave`
- **Tester Conflict Prevention**: Testers are automatically removed from waitlist/queues as players when they activate as testers
- **Queue Retention System**: When queues close and reopen, players can confirm they're still active during a grace period
- **Automatic Ticket Creation**: When a player reaches position 1, a private ticket channel is automatically created
- **Ticket Submission**: Only testers can submit tickets, which removes players from waitlist and applies cooldown
- **Persistent Data**: All data (waitlist, queues, tickets) survives bot restarts
- **Graceful Shutdown**: Data is saved on shutdown, crashes, and periodically
- **Rate Limiting and Debouncing**: Prevents button spam and reduces API calls
- **Batched Embed Updates**: Efficient embed updates to reduce Discord API usage

## Installation

### Prerequisites

- Node.js (v16.9.0 or higher)
- A Discord Bot Application ([Discord Developer Portal](https://discord.com/developers/applications))

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Soapdevs/Tierlist-bot.git
   cd Tierlist-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install discord.js@14.14.1
   ```

3. **Configure the bot**:
   - Copy `config.example.json` to `config.json`
   - Fill in your bot token, channel IDs, and role IDs
   - See [SETUP.md](docs/SETUP.md) for detailed setup instructions

4. **Start the bot**:
   ```bash
   node index.js
   ```

## Quick Setup

**Important**: The bot token is **REQUIRED** in `config.json` regardless of which setup method you choose. The bot cannot start without it.

You have two options for setup:

### Method 1: Using `/setup` Commands (Easier)

1. Create channels for waitlist and queues (EU, NA, AS)
2. Create roles for testers and region-specific ping roles (one for each region: EU, NA, AS)
3. **Create `config.json` with at minimum the `token` field** (required to start the bot)
4. Start the bot
5. Run `/setup` commands in Discord to configure everything (changes are automatically saved to `config.json`):
   - `/setup waitlist <channel>` - Creates waitlist embed and saves to config.json
   - `/setup queue <region> <channel>` - Creates queue embeds for each region and saves to config.json
   - `/setup tester-role <role>` - Sets tester role and saves to config.json
   - `/setup ping-role <region> <role>` - Sets ping role for a specific region and saves to config.json (repeat for each region: EU, NA, AS)
   - `/setup max-size <number>` - Sets max queue size and saves to config.json
   - `/setup grace-period <minutes>` - Sets grace period and saves to config.json
   - `/setup waitlist-cooldown <days>` - Sets waitlist cooldown period and saves to config.json

### Method 2: Manual Configuration

1. Create channels for waitlist and queues (EU, NA, AS)
2. Create roles for testers and region-specific ping roles (one for each region: EU, NA, AS)
3. Manually edit `config.json` with all required fields (including `token`)
4. Start the bot - it will automatically create the embeds

For detailed setup instructions with step-by-step guidance, see [SETUP.md](docs/SETUP.md).

## Commands

For detailed command usage and examples, see [SETUP.md](docs/SETUP.md#step-6-initial-bot-setup-using-commands).

### Setup Commands (Admin Only)

- `/setup waitlist <channel>` - Set the waitlist channel
  - Example: `/setup waitlist channel:#waitlist`
  - See [SETUP.md](docs/SETUP.md#61-set-waitlist-channel) for details

- `/setup queue <region> <channel>` - Set queue channel for a region (EU, NA, or AS)
  - Example: `/setup queue region:EU channel:#queue-eu`
  - See [SETUP.md](docs/SETUP.md#62-set-queue-channels) for details

- `/setup tester-role <role>` - Set the tester role
  - Example: `/setup tester-role role:@Tester` or `/setup tester-role role:1234567890123456789`
  - `<role>` can be a role mention (`@RoleName`) or role ID
  - See [SETUP.md](docs/SETUP.md#63-set-tester-role) for details

- `/setup ping-role <region> <role>` - Set role to ping when queue opens for a specific region
  - Example: `/setup ping-role region:EU role:@EU Queue` or `/setup ping-role region:NA role:1234567890123456789`
  - `<region>` must be EU, NA, or AS
  - `<role>` can be a role mention (`@RoleName`) or role ID
  - Players automatically receive this role when they join the waitlist for that region
  - See [SETUP.md](docs/SETUP.md#64-set-ping-role) for details

- `/setup max-size <number>` - Set maximum queue size (default: 20)
  - Example: `/setup max-size size:20`
  - See [SETUP.md](docs/SETUP.md#65-set-max-queue-size-optional) for details

- `/setup grace-period <minutes>` - Set confirmation grace period (default: 5)
  - Example: `/setup grace-period minutes:5`
  - See [SETUP.md](docs/SETUP.md#66-set-grace-period-optional) for details

- `/setup waitlist-cooldown <days>` - Set waitlist cooldown period (default: 30)
  - Example: `/setup waitlist-cooldown days:30`
  - See [SETUP.md](docs/SETUP.md#67-set-waitlist-cooldown-optional) for details

### Tester Commands

- `/q join` - Join as active tester (opens queue if closed)
  - Must be used in a queue channel (EU, NA, or AS)
  - Requires tester role
  - Automatically removes tester from waitlist/queues as a player
- `/q leave` - Leave as tester (closes queue if last tester)
  - Must be used in a queue channel
  - Requires tester role

### Admin Commands

- `/clear all` - Clear all data (queues, waitlist, tickets, cooldowns)
  - Requires administrator permissions
  - Does NOT affect `config.json` - configuration remains unchanged
- `/clear queues` - Clear all queue data only
- `/clear waitlist` - Clear all waitlist data and cooldowns only
- `/clear tickets` - Clear all ticket data only

## How It Works

For complete workflow documentation with detailed scenarios, see [WORKFLOW.md](docs/WORKFLOW.md).

### Player Workflow

1. **Join Waitlist**:
   - Player clicks "Join Waitlist" button in waitlist channel
   - Modal appears asking for:
     - Region (EU, NA, or AS)
     - Preferred Server (text input)
   - Player submits the form
   - Region queue channel is unlocked for the player
   - Player is automatically assigned the region-specific ping role (e.g., @EU Queue)
   - Player will be notified when that region's queue opens
   - See [WORKFLOW.md](docs/WORKFLOW.md#joining-the-waitlist) for details

2. **Join Queue**:
   - Player goes to their region queue channel
   - When a tester is active (`/q join`), the queue opens
   - Player clicks "Join Queue" button
   - Player is added to the queue
   - See [WORKFLOW.md](docs/WORKFLOW.md#joining-a-queue) for details

3. **Testing**:
   - When player reaches position 1, a private ticket channel is created
   - Only the player and tester can see the ticket channel
   - Tester can see player's region and preferred server
   - After testing:
     - **Cancel**: Both tester and player can cancel (no cooldown applied)
     - **Submit**: Only tester can submit (removes player from waitlist, revokes channel access, applies cooldown)
   - See [WORKFLOW.md](docs/WORKFLOW.md#testing-session) for details

### Tester Workflow

1. **Activate Queue**:
   - Tester goes to a queue channel (EU, NA, or AS)
   - Tester runs `/q join`
   - Queue opens and ping role is notified
   - See [WORKFLOW.md](docs/WORKFLOW.md#initial-setup-first-time) for details

2. **Testing**:
   - Players join the queue
   - When a player reaches position 1, a ticket is automatically created
   - Tester tests the player in the ticket channel
   - After testing:
     - **Cancel**: Both tester and player can cancel (no cooldown applied)
     - **Submit**: Only tester can submit (removes player from waitlist, revokes channel access, applies cooldown)
   - See [WORKFLOW.md](docs/WORKFLOW.md#daily-testing-workflow) for details

3. **Deactivate Queue**:
   - Tester runs `/q leave`
   - If last tester, queue closes and player positions are saved
   - See [WORKFLOW.md](docs/WORKFLOW.md#daily-testing-workflow) for details

### Queue States

- **Closed** 🔴: No active testers, players cannot join
- **Open** 🟢: Active testers available, players can join
- **Confirmation Period** ⏳: Queue reopening, previous players have 5 minutes to confirm they're still active

### Queue Retention System

When a queue closes with players in it:
- Player positions are saved
- When queue reopens, a confirmation period starts (5 minutes)
- Previous players are pinged and can click "Still Active" button
- After 5 minutes, confirmed players keep their positions (renumbered), unconfirmed players are removed
- See [WORKFLOW.md](docs/WORKFLOW.md#confirmation-period-experience) for complete details

## Configuration File Reference

The bot uses `config.json` for configuration. See `config.example.json` for a template.

**Important**: The `token` field is **REQUIRED** - the bot cannot start without it.

### Configuration Fields

**Required Fields**:
- `token`: Discord bot token (get from [Discord Developer Portal](https://discord.com/developers/applications)) - **REQUIRED to start bot**
- `waitlistChannelId`: Channel ID for waitlist (right-click channel → Copy ID)
- `queueChannels`: Object with EU, NA, AS channel IDs (right-click each channel → Copy ID)
  ```json
  "queueChannels": {
    "EU": "channel_id_here",
    "NA": "channel_id_here",
    "AS": "channel_id_here"
  }
  ```
- `testerRoleId`: Role ID for testers (right-click role → Copy ID)
- `pingRoles`: Object with EU, NA, AS role IDs (right-click each role → Copy ID)
  ```json
  "pingRoles": {
    "EU": "role_id_here",
    "NA": "role_id_here",
    "AS": "role_id_here"
  }
  ```
  - Players automatically receive the corresponding region role when they join the waitlist
  - These roles are pinged when their respective queues open

**Optional Fields**:
- `maxQueueSize`: Maximum players per queue (default: 20)
- `confirmationGracePeriod`: Grace period in minutes for confirmation period (default: 5)
- `waitlistCooldownDays`: Cooldown period in days before players can rejoin waitlist after submission (default: 30)

For instructions on getting channel and role IDs, see [SETUP.md](docs/SETUP.md#how-to-get-channel-and-role-ids).

## Data Files

The bot creates and manages these data files:
- `waitlist-data.json`: Waitlist user data
- `queue-data.json`: Queue state and positions
- `tickets-data.json`: Active ticket information

All data is automatically saved and persists across bot restarts.

## Documentation

- **[SETUP.md](docs/SETUP.md)** - Detailed setup guide
- **[WORKFLOW.md](docs/WORKFLOW.md)** - Complete workflow documentation

## License

See [LICENSE](LICENSE) file for details.
