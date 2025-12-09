# PVP Tierlist
PVP Tierlist Discord bot for managing testing queues across different game modes.

## Installation
Github:
```
git clone https://github.com/Soapdevs/Tierlist-bot.git
```

NpmJS:
```
npm i discord.js@14.14.1
```

## Setup
1. Copy `config.example.json` to `config.json`
2. Add your Discord bot token
3. Optionally set a `defaultRoleID` for testers (can also be set per queue)

## Usage
```
node index.js
```

## Commands

### `/createqueue name [role]`
- **Admin only** - Creates a new queue with an embed in the current channel
- The embed starts in **offline** mode
- `name`: Name of the queue (e.g., "speed-sword", "sword")
- `role`: (Optional) Tester role ID. Uses default from config if not provided

### `/testqueue join queuename`
- Allows a tester to join a queue
- Requires the tester role for that queue
- Testers can then toggle their availability

### `/stopqueue name`
- **Admin only** - Deletes a queue and its embed

### `/remove queuename user`
- **Admin only** - Removes a user from a specific queue

## Workflow

1. **Create Queue**: Admin uses `/createqueue "speed-sword"` in a channel
   - Embed appears in **offline** mode (red)
   - No testers yet

2. **Tester Joins**: Tester uses `/testqueue join "speed-sword"`
   - Tester is added to the queue
   - Embed switches to **online** mode (green) if tester is available

3. **Players Join**: Players click "Join Queue" button on the embed
   - Only works when queue is online

4. **Testing**: Tester tests players in queue

5. **Close Queue**: Tester clicks "Close Queue" button
   - Queue goes to **offline** mode
   - All positions are saved

6. **Reopen Queue**: When tester becomes available again
   - If there are previous queue members, **retention period** starts (2 minutes)
   - Previous members are mentioned and can click "Retain Position"
   - After 2 minutes, retained users move to front, queue opens to everyone

## Features
- Name-based queues (not channel-based)
- Persistent embeds (always visible, toggle offline/online)
- Tester availability system
- Queue inactivity system (users must click "Keep Spot" every 2 minutes)
- Retention period system (2 minutes to retain position when queue reopens)
- Automatic persistence (queues survive bot restarts)
- Automatic queue reorganization after retention period
- Real-time embed updates (no waiting for intervals)
- Rate limiting (prevents button spam)
- Autocomplete for queue names
- Automatic message/channel recovery

## Detailed Workflows
See [WORKFLOW.md](WORKFLOW.md) for complete tester and player experience workflows.
