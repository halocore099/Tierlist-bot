# Queue System Workflows

## 🧪 TESTER EXPERIENCE

### Initial Setup (First Time)
1. **Admin creates queue**: Admin uses `/createqueue "speed-sword"` in a channel
   - Queue embed appears in **🔴 OFFLINE** state (red)
   - Embed shows: "No testers registered"
   - Players cannot join yet

2. **Tester joins queue**: Tester uses `/testqueue join "speed-sword"`
   - Bot checks: Does tester have the required role? ✅
   - Tester is added to the queue
   - Tester is marked as **available** by default
   - Queue state changes: **OFFLINE** → **🟢 ONLINE** (green)
   - Embed updates immediately showing tester in "Available Testers" section
   - "Join Queue" button becomes enabled for players

### Daily Testing Workflow

#### Scenario A: Starting Fresh (No Previous Queue Members)
1. **Tester becomes available**:
   - Tester clicks **"Toggle Availability"** button (if they were unavailable)
   - OR tester joins queue for first time (auto-available)
   - Queue state: **🟢 ONLINE**
   - Players can now click "Join Queue"

2. **Testing players**:
   - Players join queue via "Join Queue" button
   - Tester sees players appear in queue list on embed
   - Tester tests players one by one (outside the bot)
   - Queue embed updates every 10 seconds automatically
   - Players must click "Keep Spot" every 2 minutes or get pushed to back

3. **Tester needs a break**:
   - Tester clicks **"Toggle Availability"** button
   - Status changes: Available → Unavailable
   - If no other testers are available, queue goes **🔴 OFFLINE**
   - "Join Queue" button becomes disabled
   - Players already in queue stay in queue (positions saved)

4. **Tester comes back**:
   - Tester clicks **"Toggle Availability"** again
   - Status: Unavailable → Available
   - Queue goes back **🟢 ONLINE**
   - Players can join again

5. **Tester finishes for the day**:
   - Tester clicks **"Close Queue"** button
   - All testers marked as unavailable
   - Queue state: **🟢 ONLINE** → **🔴 OFFLINE**
   - All player positions are **saved**
   - Queue embed shows offline status
   - Players cannot join, but their positions remain

#### Scenario B: Reopening Queue with Previous Members
1. **Tester reopens queue** (after it was closed with players in it):
   - Tester clicks **"Toggle Availability"** (or joins as tester)
   - Bot checks: Are there previous queue members? ✅ Yes
   - Queue enters **⏳ RETENTION PERIOD** state (orange)
   - Bot sends notification: `🔔 Queue "speed-sword" reopened! Previous queue members: @user1, @user2... You have **2 minutes** to click "Retain Position"!`
   - Embed shows:
     - Orange color
     - Countdown timer (2:00, 1:59, 1:58...)
     - "Retain Position" button appears
     - "Join Queue" button is disabled

2. **During retention period** (2 minutes):
   - Previous members can click **"Retain Position"** button
   - They get ✅ checkmark next to their name
   - Embed updates immediately showing their retained status
   - New players cannot join yet

3. **After 2 minutes**:
   - Retention period ends automatically
   - Bot reorganizes queue:
     - Retained users → moved to **front**
     - Non-retained users → moved to **back**
   - Queue state: **⏳ RETENTION PERIOD** → **🟢 ONLINE**
   - Bot sends notification: `✅ Retention period ended! Queue is now open to everyone. Retained users have been moved to the front.`
   - "Join Queue" button becomes enabled
   - New players can now join (will be added after retained users)

4. **Testing continues**:
   - Tester tests players in order (retained users first, then new ones)
   - Normal workflow continues

### Tester Controls
- **Toggle Availability**: Switch between available/unavailable
- **Close Queue**: Mark all testers unavailable and save queue state
- **View Queue**: See all players, their positions, and who's retained

---

## 👥 USER/PLAYER EXPERIENCE

### Joining a Queue

1. **Find queue embed**:
   - Player sees queue embed in channel
   - Embed shows current status:
     - **🟢 ONLINE** (green) = Can join
     - **🔴 OFFLINE** (red) = Cannot join, no testers
     - **⏳ RETENTION PERIOD** (orange) = Cannot join yet, waiting for previous members

2. **Join queue** (when online):
   - Player clicks **"Join Queue"** button
   - Bot checks: Is queue online? ✅
   - Player is added to queue
   - Embed updates **immediately** showing player in queue list
   - Player sees their position number (e.g., "3. @player")
   - Player gets confirmation: "You have successfully joined the queue."

3. **Maintain position**:
   - Player must click **"Keep Spot"** button every **2 minutes**
   - If player doesn't click within 2 minutes:
     - Player is automatically pushed to the **back** of queue
     - Other active players move up
   - Embed updates every 10 seconds showing current positions
   - Player gets confirmation: "Your spot has been confirmed! You have 2 minutes before you need to click again."

4. **Leave queue**:
   - Player clicks **"Leave Queue"** button
   - Player is removed immediately
   - Embed updates showing player is gone
   - Player gets confirmation: "You have left the queue."

### Retention Period Experience

1. **Queue was closed, now reopening**:
   - Player was in queue when tester closed it
   - Player receives notification: `🔔 Queue "speed-sword" reopened! Previous queue members: @you, @others... You have **2 minutes** to click "Retain Position"!`
   - Embed changes to orange **⏳ RETENTION PERIOD** state
   - "Join Queue" button disappears
   - "Retain Position" button appears

2. **Retain position**:
   - Player clicks **"Retain Position"** button
   - Player gets ✅ checkmark next to their name
   - Embed updates immediately showing retained status
   - Player gets confirmation: "✅ Your position has been retained! You'll keep your spot when the queue opens."

3. **If player doesn't retain**:
   - Player doesn't click "Retain Position" within 2 minutes
   - Player is moved to the **back** of queue
   - Retained players move to front
   - Player can still be tested, but later

4. **After retention period**:
   - Queue opens to everyone
   - Retained players are at front
   - Non-retained players are at back
   - New players can join (added after retained players)

### Queue States (Player Perspective)

#### 🟢 ONLINE (Green)
- **Can join**: Yes ✅
- **Can leave**: Yes ✅
- **Can keep spot**: Yes ✅
- **What it means**: Testers are available, testing is happening

#### 🔴 OFFLINE (Red)
- **Can join**: No ❌ (button disabled)
- **Can leave**: Yes ✅ (if already in queue)
- **Can keep spot**: No ❌ (button disabled)
- **What it means**: No testers available, queue is closed
- **Note**: Your position is saved, you'll be notified when queue reopens

#### ⏳ RETENTION PERIOD (Orange)
- **Can join**: No ❌ (button disabled)
- **Can leave**: Yes ✅
- **Can retain position**: Yes ✅ (if you were in previous queue)
- **What it means**: Queue is reopening, previous members have 2 minutes to retain spots
- **Countdown**: Shows time remaining (e.g., "1:23 remaining")

### Visual Indicators

- **🧪** next to name = User is also a tester
- **✅** next to name = User has retained their position (during retention period)
- **Position number** = Your place in line (1 = first, 2 = second, etc.)

### Important Rules

1. **Inactivity**: Click "Keep Spot" every 2 minutes or get pushed to back
2. **Retention**: When queue reopens, you have 2 minutes to retain your spot
3. **Rate limiting**: Can't spam buttons (1 second cooldown)
4. **Queue order**: Retained users → Non-retained users → New users

---

## 🔄 Complete Example Scenario

### Day 1 - Evening Session
1. **6:00 PM**: Admin creates "speed-sword" queue → 🔴 OFFLINE
2. **6:05 PM**: Tester joins → 🟢 ONLINE
3. **6:10 PM**: Player1 joins (position 1)
4. **6:12 PM**: Player2 joins (position 2)
5. **6:15 PM**: Player3 joins (position 3)
6. **6:20 PM**: Tester tests Player1, Player2
7. **6:30 PM**: Tester clicks "Close Queue" → 🔴 OFFLINE
   - All positions saved: [Player1, Player2, Player3]

### Day 2 - Morning Session
1. **10:00 AM**: Tester clicks "Toggle Availability" → ⏳ RETENTION PERIOD
   - Bot mentions: @Player1, @Player2, @Player3
   - 2-minute countdown starts
2. **10:01 AM**: Player1 clicks "Retain Position" ✅
3. **10:01 AM**: Player2 clicks "Retain Position" ✅
4. **10:02 AM**: Player3 doesn't click (missed notification)
5. **10:02 AM**: Retention period ends
   - Queue order: [Player1 ✅, Player2 ✅, Player3 ❌]
   - Queue state: 🟢 ONLINE
6. **10:03 AM**: Player4 joins (position 4, after retained players)
7. **10:05 AM**: Tester tests Player1, Player2, Player3, Player4
8. **10:30 AM**: Tester closes queue → 🔴 OFFLINE
   - New positions saved: [Player1, Player2, Player3, Player4]

---

## 💡 Key Features

- **Persistent**: Queues survive bot restarts
- **Automatic**: Inactivity checks, retention periods, queue reorganization
- **Real-time**: Embeds update immediately on actions
- **Fair**: Inactive users pushed back, retained users prioritized
- **Flexible**: Multiple testers can work simultaneously
- **Recovery**: Messages/channels auto-recover if deleted

