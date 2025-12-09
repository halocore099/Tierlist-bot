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

For detailed setup instructions, see [SETUP.md](docs/SETUP.md).

## Commands

### Setup Commands (Admin Only)

- `/setup waitlist <channel>` - Set the waitlist channel
- `/setup queue <region> <channel>` - Set queue channel for a region (EU, NA, or AS)
- `/setup tester-role <role>` - Set the tester role
- `/setup ping-role <role>` - Set role to ping when queue opens
- `/setup max-size <number>` - Set maximum queue size (default: 20)
- `/setup grace-period <minutes>` - Set confirmation grace period (default: 5)

### Tester Commands

- `/q join` - Join as active tester (opens queue if closed)
  - Must be used in a queue channel (EU, NA, or AS)
  - Requires tester role
  - Automatically removes tester from waitlist/queues as a player
- `/q leave` - Leave as tester (closes queue if last tester)
  - Must be used in a queue channel
  - Requires tester role

## How It Works

### Player Workflow

1. **Join Waitlist**:
   - Player clicks "Join Waitlist" button in waitlist channel
   - Modal appears asking for:
     - Region (EU, NA, or AS)
     - Preferred Server (text input)
   - Player submits the form
   - Region queue channel is unlocked for the player

2. **Join Queue**:
   - Player goes to their region queue channel
   - When a tester is active (`/q join`), the queue opens
   - Player clicks "Join Queue" button
   - Player is added to the queue

3. **Testing**:
   - When player reaches position 1, a private ticket channel is created
   - Only the player and tester can see the ticket channel
   - Tester can see player's region and preferred server
   - After testing, tester clicks "Cancel" or "Submit" to close the ticket

### Tester Workflow

1. **Activate Queue**:
   - Tester goes to a queue channel (EU, NA, or AS)
   - Tester runs `/q join`
   - Queue opens and ping role is notified

2. **Testing**:
   - Players join the queue
   - When a player reaches position 1, a ticket is automatically created
   - Tester tests the player in the ticket channel
   - Tester clicks "Cancel" or "Submit" to close the ticket

3. **Deactivate Queue**:
   - Tester runs `/q leave`
   - If last tester, queue closes and player positions are saved

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

## Configuration

The bot uses `config.json` for configuration. See `config.example.json` for the structure.

**Required Fields**:
- `token`: Discord bot token
- `waitlistChannelId`: Channel ID for waitlist
- `queueChannels`: Object with EU, NA, AS channel IDs
- `testerRoleId`: Role ID for testers
- `pingRoleId`: Role ID to ping when queue opens

**Optional Fields**:
- `maxQueueSize`: Maximum players per queue (default: 20)
- `confirmationGracePeriod`: Grace period in minutes (default: 5)

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
