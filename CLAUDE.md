# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot for managing region-based testing queues with a waitlist system. Players join a waitlist, unlock their region queue channel, and can join queues when testers are active. Built with discord.js v14.

## Commands

```bash
# Install dependencies
npm install

# Run the bot
node index.js
```

No build step, linting, or tests are configured.

## Architecture

### Core Modules (flat structure, all in root directory)

- **index.js** - Main entry point, Discord client setup, event handlers, slash command registration, button/modal handlers, periodic tasks (ticket creation, queue updates, confirmation period checks)
- **configManager.js** - Loads/saves `config.json`, validates required fields, handles nested key updates
- **queueManager.js** - Queue state machine (closed → open → confirmation_period), user/tester management, embed builders
- **waitlistManager.js** - Waitlist CRUD, cooldown tracking, channel unlock tracking
- **ticketManager.js** - Ticket lifecycle (create, close), lookup by ID/channel/user
- **persistence-util.js** - Atomic file writes (write to .tmp then rename) used by all managers

### Data Flow

1. **Waitlist → Queue → Ticket**: Player joins waitlist via modal → unlocks region channel → joins queue when tester active → reaches position 1 → ticket auto-created
2. **Queue States**: `closed` (no testers) → `open` (testers active) → `confirmation_period` (queue reopening with previous users)
3. **Confirmation Period**: When queue reopens with previous users, they have a grace period to click "Still Active" button to retain position

### Persistence Files (JSON, auto-saved)

- `config.json` - Bot configuration (token, channel IDs, role IDs, settings)
- `queue-data.json` - Queue state per region (EU, NA, AS)
- `waitlist-data.json` - Waitlist users and cooldowns
- `tickets-data.json` - Active tickets

### Key Constants

- `REGIONS = ["EU", "NA", "AS"]` - Fixed region set
- `BUTTON_RATE_LIMIT_MS = 1000` - Button spam prevention
- `SAVE_DEBOUNCE_MS = 2000` - Queue save debouncing
- Periodic saves every 30 seconds, queue embed updates every 10 seconds

### Discord Slash Commands

- `/setup` subcommands - Admin configuration (waitlist channel, queue channels, roles, settings)
- `/q join|leave` - Tester activation/deactivation (must be in queue channel)
- `/clear all|queues|waitlist|tickets` - Admin data clearing

### Button/Modal Custom IDs

- `joinWaitlist` - Opens registration modal
- `waitlistModal` - Modal submission with region + preferred server
- `joinQueue_{region}` - Join specific region queue
- `confirmActive_{region}` - Confirm still active during confirmation period
- `ticketCancel_{ticketId}` / `ticketSubmit_{ticketId}` - Ticket actions
