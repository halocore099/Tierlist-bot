# Queue System Workflows


## 🧪 TESTER EXPERIENCE

### Initial Setup (First Time)
1. **Tester activates queue**: Tester goes to a queue channel (EU, NA, or AS) and uses `/q join`
   - Bot checks: Does tester have the required role? ✅
   - Tester is marked as active
   - Queue state changes: **CLOSED** → **🟢 OPEN** (green)
   - Embed updates immediately showing tester in "Active Testers" section
   - "Join Queue" button becomes enabled for players
   - Ping role is notified that the queue is open

### Daily Testing Workflow

#### Scenario A: Starting Fresh (No Previous Queue Members)
1. **Tester becomes available**:
   - Tester uses `/q join` in a queue channel
   - Queue state: **🟢 OPEN**
   - Players can now click "Join Queue"

2. **Testing players**:
   - Players join queue via "Join Queue" button
   - Tester sees players appear in queue list on embed
   - When a player reaches position 1, a ticket channel is automatically created
   - Tester tests players one by one in the ticket channels
   - Queue embed updates every 10 seconds automatically

3. **Tester needs a break**:
   - Tester uses `/q leave`
   - If last tester, queue goes **🔴 CLOSED**
   - "Join Queue" button becomes disabled
   - Player positions are saved

4. **Tester comes back**:
   - Tester uses `/q join` again
   - Queue goes back **🟢 OPEN**
   - Players can join again

#### Scenario B: Reopening Queue with Previous Members
1. **Tester reopens queue** (after it was closed with players in it):
   - Tester uses `/q join` in the queue channel
   - Bot checks: Are there previous queue members? ✅ Yes
   - Queue enters **⏳ CONFIRMATION PERIOD** state (orange)
   - Bot sends a confirmation message pinging all previous members
   - Embed shows:
     - Orange color
     - Countdown timer (5:00, 4:59, 4:58...)
     - "Still Active" button appears in confirmation message
     - "Join Queue" button is disabled

2. **During confirmation period** (5 minutes):
   - Previous members can click **"Still Active"** button
   - They get ✅ checkmark next to their name
   - Embed updates showing their confirmed status
   - New players cannot join yet

3. **After 5 minutes**:
   - Confirmation period ends automatically
   - Bot reorganizes queue:
     - Confirmed users → renumbered to fill gaps (e.g., positions 1,4,5,7 → 1,2,3,4)
     - Unconfirmed users → removed from queue
   - Queue state: **⏳ CONFIRMATION PERIOD** → **🟢 OPEN**
   - "Join Queue" button becomes enabled
   - New players can now join

4. **Testing continues**:
   - Tester tests players in order (confirmed users first, then new ones)
   - Normal workflow continues

### Tester Controls
- **`/q join`**: Activate as tester and open queue
- **`/q leave`**: Deactivate as tester (closes queue if last tester)
- **View Queue**: See all players, their positions, and confirmation status

---

## 👥 USER/PLAYER EXPERIENCE

### Joining the Waitlist

1. **Find waitlist channel**:
   - Player sees waitlist embed in the waitlist channel
   - Embed shows "Join Waitlist" button

2. **Join waitlist**:
   - Player clicks **"Join Waitlist"** button
   - Modal appears with two fields:
     - **Region**: Dropdown or text input (EU, NA, or AS)
     - **Preferred Server**: Text input (player's preferred server name)
   - Player fills in the form and submits

3. **Validation**:
   - Bot validates region (must be EU, NA, or AS)
   - If invalid: Error message, player can try again
   - If valid: Success!

4. **Channel unlocked**:
   - Player's region queue channel is unlocked
   - Player can now see and access their region queue channel
   - Player gets confirmation: "✅ You have joined the waitlist for [REGION]! The [REGION] queue channel has been unlocked for you."

### Joining a Queue

1. **Find queue embed**:
   - Player goes to their unlocked region queue channel
   - Player sees queue embed showing current status:
     - **🟢 OPEN** (green) = Can join
     - **🔴 CLOSED** (red) = Cannot join, no testers
     - **⏳ CONFIRMATION PERIOD** (orange) = Cannot join yet, waiting for previous members

2. **Join queue** (when open):
   - Player clicks **"Join Queue"** button
   - Bot checks: Is queue open? ✅
   - Player is added to queue
   - Embed updates **immediately** showing player in queue list
   - Player sees their position number (e.g., "3. @player")
   - Player gets confirmation: "You have successfully joined the queue."

3. **Waiting in queue**:
   - Player waits for their turn
   - Embed updates every 10 seconds showing current positions
   - When player reaches position 1, a ticket channel is automatically created

4. **Testing session**:
   - Private ticket channel is created (only player and tester can see)
   - Ticket shows player's region and preferred server
   - Tester tests the player
   - After testing, tester clicks "Cancel" or "Submit" to close the ticket

5. **Leave queue** (optional):
   - Player can leave at any time (though this is rare once in queue)
   - Player is removed immediately
   - Embed updates showing player is gone

### Confirmation Period Experience

1. **Queue was closed, now reopening**:
   - Player was in queue when tester closed it
   - Player receives ping in queue channel: `@player The [REGION] queue has reopened! If you're still active, please click the button below within **5:00** to keep your position in the queue.`
   - Embed changes to orange **⏳ CONFIRMATION PERIOD** state
   - "Join Queue" button disappears
   - "Still Active" button appears in confirmation message

2. **Retain position**:
   - Player clicks **"Still Active"** button
   - Player gets ✅ checkmark next to their name in the embed
   - Embed updates showing retained status
   - Player gets confirmation: "✅ You have confirmed you're still active! Your position will be retained."

3. **If player doesn't retain**:
   - Player doesn't click "Still Active" within 5 minutes
   - Player is removed from queue
   - Confirmed players keep their positions (renumbered)

4. **After confirmation period**:
   - Queue opens to everyone
   - Confirmed players are at front (renumbered to fill gaps)
   - New players can join (added after confirmed players)

### Queue States (Player Perspective)

#### 🟢 OPEN (Green)
- **Can join**: Yes ✅
- **Can leave**: Yes ✅ (if already in queue)
- **What it means**: Testers are available, testing is happening

#### 🔴 CLOSED (Red)
- **Can join**: No ❌ (button disabled)
- **Can leave**: Yes ✅ (if already in queue)
- **What it means**: No testers available, queue is closed
- **Note**: Your position is saved, you'll be pinged when queue reopens

#### ⏳ CONFIRMATION PERIOD (Orange)
- **Can join**: No ❌ (button disabled)
- **Can retain position**: Yes ✅ (if you were in previous queue)
- **What it means**: Queue is reopening, previous members have 5 minutes to confirm they're still active
- **Countdown**: Shows time remaining (e.g., "4:23 remaining")

### Visual Indicators

- **Position number** = Your place in line (1 = first, 2 = second, etc.)
- **✅** next to name = User has confirmed they're still active (during confirmation period)

### Important Rules

1. **Waitlist First**: You must join the waitlist before you can access queue channels
2. **Region Selection**: Choose your region carefully (EU, NA, or AS) - this unlocks that specific queue channel
3. **Confirmation**: When queue reopens, you have 5 minutes to confirm you're still active
4. **Rate limiting**: Can't spam buttons (1 second cooldown for most buttons, 5 seconds for "Still Active")
5. **Queue order**: Confirmed users → New users

---

## 🔄 Complete Example Scenario

### Day 1 - Evening Session
1. **6:00 PM**: Player1 joins waitlist (Region: EU, Server: "Server1")
   - EU queue channel unlocked for Player1
2. **6:05 PM**: Tester uses `/q join` in EU queue channel → 🟢 OPEN
3. **6:10 PM**: Player1 joins queue (position 1)
4. **6:12 PM**: Player2 joins waitlist (Region: EU, Server: "Server2")
   - EU queue channel unlocked for Player2
5. **6:15 PM**: Player2 joins queue (position 2)
6. **6:20 PM**: Player1 reaches position 1 → Ticket created
   - Tester tests Player1 in ticket channel
7. **6:30 PM**: Tester uses `/q leave` → 🔴 CLOSED
   - All positions saved: [Player1, Player2]

### Day 2 - Morning Session
1. **10:00 AM**: Tester uses `/q join` in EU queue channel → ⏳ CONFIRMATION PERIOD
   - Bot pings: @Player1 @Player2
   - 5-minute countdown starts
2. **10:01 AM**: Player1 clicks "Still Active" ✅
3. **10:02 AM**: Player2 clicks "Still Active" ✅
4. **10:05 AM**: Confirmation period ends
   - Queue order: [Player1 ✅, Player2 ✅] (both confirmed)
   - Queue state: 🟢 OPEN
5. **10:06 AM**: Player3 joins waitlist (Region: EU, Server: "Server3")
   - EU queue channel unlocked for Player3
6. **10:07 AM**: Player3 joins queue (position 3, after confirmed players)
7. **10:10 AM**: Player1 reaches position 1 → Ticket created
   - Tester tests Player1, Player2, Player3
8. **10:30 AM**: Tester uses `/q leave` → 🔴 CLOSED
   - New positions saved: [Player1, Player2, Player3]

---

## 💡 Key Features

- **Waitlist System**: Players must join waitlist first to unlock queue channels
- **Region-Based**: Separate queues for EU, NA, and AS regions
- **Persistent**: Queues survive bot restarts
- **Automatic**: Ticket creation, confirmation periods, queue reorganization
- **Real-time**: Embeds update immediately on actions
- **Fair**: Confirmed users prioritized, unconfirmed users removed
- **Flexible**: Multiple testers can work simultaneously
- **Recovery**: Messages/channels auto-recover if deleted
- **Graceful**: Data saved on shutdown, crashes, and periodically
