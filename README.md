# Discord Waitlist Queue Bot

A Discord bot for managing region-based testing queues with a waitlist system. Players join a waitlist, unlock their region queue channel, and can join queues when testers are active.

## Features

- **Waitlist System**: Players join a waitlist with region selection and preferred server info
- **Region-Based Queues**: Separate queues for EU, NA, and AS regions
- **Channel Unlocking**: Players unlock their region queue channel after joining the waitlist
- **Tester Management**: Testers can activate/deactivate queues using `/q join` and `/q leave`
- **Queue Retention**: When queues close and reopen, players can confirm they're still active
- **Automatic Ticket Creation**: When a player reaches position 1, a private ticket channel is created
- **Persistent Data**: All data survives bot restarts
- **Graceful Shutdown**: Data is saved on shutdown, crashes, and periodically

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

1. Create channels for waitlist and queues (EU, NA, AS)
2. Create roles for testers and ping notifications
3. Configure `config.json` with all IDs
4. Run `/setup` commands in Discord to initialize embeds
5. Update `config.json` manually (commands will remind you)

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

- `/setup ping-role <role>` - Set role to ping when queue opens
  - Example: `/setup ping-role role:@Queue Notifications` or `/setup ping-role role:1234567890123456789`
  - `<role>` can be a role mention (`@RoleName`) or role ID
  - See [SETUP.md](docs/SETUP.md#64-set-ping-role) for details

- `/setup max-size <number>` - Set maximum queue size (default: 20)
  - Example: `/setup max-size size:20`
  - See [SETUP.md](docs/SETUP.md#65-set-max-queue-size-optional) for details

- `/setup grace-period <minutes>` - Set confirmation grace period (default: 5)
  - Example: `/setup grace-period minutes:5`
  - See [SETUP.md](docs/SETUP.md#66-set-grace-period-optional) for details

### Tester Commands

- `/q join` - Join as active tester (opens queue if closed)
  - Must be used in a queue channel (EU, NA, or AS)
  - Requires tester role
  - Automatically removes tester from waitlist/queues as a player
- `/q leave` - Leave as tester (closes queue if last tester)
  - Must be used in a queue channel
  - Requires tester role

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
   - After testing, tester clicks "Cancel" or "Submit" to close the ticket
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
   - Tester clicks "Cancel" or "Submit" to close the ticket
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

## Configuration

The bot uses `config.json` for configuration. See `config.example.json` for the structure.

For detailed configuration instructions, see [SETUP.md](docs/SETUP.md#step-3-configure-the-bot).

**Required Fields**:
- `token`: Discord bot token (get from [Discord Developer Portal](https://discord.com/developers/applications))
- `waitlistChannelId`: Channel ID for waitlist (right-click channel → Copy ID)
- `queueChannels`: Object with EU, NA, AS channel IDs (right-click each channel → Copy ID)
- `testerRoleId`: Role ID for testers (right-click role → Copy ID)
- `pingRoleId`: Role ID to ping when queue opens (right-click role → Copy ID)

**Optional Fields**:
- `maxQueueSize`: Maximum players per queue (default: 20)
- `confirmationGracePeriod`: Grace period in minutes (default: 5)

See [SETUP.md](docs/SETUP.md#how-to-get-channel-and-role-ids) for instructions on getting IDs.

## Data Files

The bot creates and manages these data files:
- `waitlist-data.json`: Waitlist user data
- `queue-data.json`: Queue state and positions
- `tickets-data.json`: Active ticket information

All data is automatically saved and persists across bot restarts.

## Features

- ✅ Waitlist system with modal registration
- ✅ Region-based queues (EU, NA, AS)
- ✅ Automatic channel unlocking
- ✅ Tester conflict prevention (testers can't be in queues as players)
- ✅ Queue retention with confirmation period
- ✅ Automatic ticket creation
- ✅ Graceful shutdown handling
- ✅ Periodic backup saves
- ✅ Rate limiting and debouncing
- ✅ Batched embed updates

## Documentation

- **[SETUP.md](docs/SETUP.md)** - Detailed setup guide
- **[WORKFLOW.md](docs/WORKFLOW.md)** - Complete workflow documentation

## License

See [LICENSE](LICENSE) file for details.
