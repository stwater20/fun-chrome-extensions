# Chrome Web Store listing text

Copy-paste for the Developer Dashboard. For every extension:

- **Remote code:** No, I am not using remote code.
- **Privacy policy URL:** `https://github.com/stwater20/fun-chrome-extensions/blob/main/PRIVACY.md`
- **Screenshots / promo tile:** `store/<extension>/`
- **Data usage certification:** tick all three ("not sold", "not used for unrelated purposes", "not used for creditworthiness").

---

## ⌨️ Typing Rampage — 打字暴走模式

**Category:** Fun · **Language:** English (also 中文 (繁體))

**Description (EN)**
```
Every keystroke explodes.

Typing Rampage turns every text box on the web into an arcade game: particles burst from your cursor, the box shakes, and a combo meter counts your streak.

• Combo levels: NICE → GREAT → RAMPAGE! → UNSTOPPABLE → GODLIKE
• Fire, ice, rainbow and mono particle colors
• Adjustable intensity, optional sound effects
• Turn it off for any site with one click
• Tracks your best combo and total keys exploded
• Password fields are never touched

No accounts, no tracking. Everything stays in your browser.
```
**描述（中文）**
```
每打一個字都會爆炸。

打字暴走模式把網路上每個輸入框變成街機遊戲：游標噴出粒子、輸入框震動，右上角還有連擊計數。

• 連擊等級：NICE → GREAT → RAMPAGE! → UNSTOPPABLE → GODLIKE
• 彩虹、火焰、冰晶、黑白四種粒子顏色
• 可調整強度，可開啟音效
• 一鍵對特定網站關閉
• 記錄最高連擊與總按鍵數
• 密碼欄位完全不會被碰到

不用註冊、不追蹤，所有資料都留在你的瀏覽器裡。
```
**Single purpose:** Adds visual typing effects (particles, shake, combo counter) to text fields.
**Permission justifications**
- `storage`: Saves the user's effect settings and best combo.
- Host permission (content script on all sites): The effects must run inside text boxes on whatever site the user is typing on. The script only reacts to key presses in text fields and never reads or stores what is typed.

**Data collected:** none.

---

## 🧱 Page Physics — 網頁物理模式

**Category:** Fun

**Description (EN)**
```
One click and the page loses gravity.

Headlines, images, buttons and paragraphs tumble to the bottom of the screen. Grab them, throw them, stack them.

• Drag and throw anything
• Space: earthquake
• Arrow keys: change gravity direction
• 0: zero gravity
• B or double-click: bomb
• Esc: everything snaps back exactly as it was

Shortcut: Alt+Shift+G. The extension can't see any page until you click its icon. Physics by Matter.js (bundled).
```
**描述（中文）**
```
按一下，整個網頁失去重力。

標題、圖片、按鈕、段落全部掉到螢幕底部，可以抓起來丟、拿來疊。

• 拖曳、丟擲任何東西
• 空白鍵：地震
• 方向鍵：改變重力方向
• 0：無重力
• B 或連點兩下：炸彈
• Esc：一切恢復原狀

快捷鍵 Alt+Shift+G。按下圖示之前，這個擴充功能看不到任何網頁。
```
**Single purpose:** Lets the user play with the current page's elements in a physics simulation.
**Permission justifications**
- `activeTab`: Access the current tab only after the user clicks the icon.
- `scripting`: Inject the bundled physics script into that tab.

**Data collected:** none.

---

## 🐣 Tab Pet — 分頁寵物

**Category:** Fun

**Description (EN)**
```
A little blob lives in your toolbar and eats your tabs.

Open a tab and you feed it. Open too many and it gets chubby, then bloated, then sweaty, then… it might explode. Close tabs and it gets its exercise.

• Live toolbar icon that changes with your tab count
• Name your pet, watch it grow up
• Daily stats: tabs fed, tabs closed, snacks
• One-click "close duplicate tabs" workout
• Snack mode (off by default): when you have too many tabs, it nibbles your least-recently-used tab. Never pinned tabs, tabs playing audio or the one you're on
• Everything it eats can be spat back out (reopened)

No accounts, no tracking. Everything stays in your browser.
```
**描述（中文）**
```
工具列上住著一隻吃分頁的小怪獸。

開分頁就是在餵牠。開太多牠會變胖、變撐、開始流汗，最後……可能會爆炸。關掉分頁就是幫牠運動。

• 工具列圖示會隨分頁數即時變化
• 幫寵物取名，看牠一天天長大
• 每日統計：餵食、運動、點心
• 一鍵關閉重複分頁
• 點心模式（預設關閉）：分頁太多時，牠會吃掉你最久沒看的分頁；釘選分頁、正在播放聲音的分頁和目前分頁都不會被吃
• 吃掉的分頁隨時可以吐回來（重新開啟）

不用註冊、不追蹤，資料都留在你的瀏覽器裡。
```
**Single purpose:** A virtual pet whose mood reflects the number of open tabs, with optional tab cleanup.
**Permission justifications**
- `tabs`: Count open tabs, find duplicate and least-recently-used tabs, and read the title/URL of a tab the pet closes so the user can reopen it from the popup.
- `storage`: Save the pet's name, stats and settings.
- `alarms`: Periodic check for snack mode (only when the user enables it).

**Data collected:** Web history (titles/URLs of tabs closed by snack mode) — stored only locally, not transmitted.

---

## 🖍️ Web Graffiti — 網頁塗鴉牆

**Category:** Fun (or Social & Communication)

**Description (EN)**
```
Leave sticky notes and doodles on any website.

Press Alt+Shift+N (or click the icon) and a toolbar appears: stick notes, draw with a pen in 7 colors, undo, hide. Your graffiti is saved for that page and is waiting for you next time you visit.

Want friends to see it? Run the tiny open-source graffiti server (link on the options page) and everyone connected to it sees each other's notes, drawings and cursors live.

• Sticky notes you can drag, recolor and edit
• Freehand drawing with adjustable pen size
• Live multiplayer with cursors (optional, self-hosted)
• Privacy by design: the server only receives a SHA-256 hash of the page address, never the address itself
• Only you can edit or delete what you made
• Mute anyone with one click
• Export / import your graffiti

Multiplayer is off by default. Without a server, everything stays in your browser.
```
**描述（中文）**
```
在任何網站上貼便利貼、隨手塗鴉。

按 Alt+Shift+N（或點圖示）叫出工具列：貼便利貼、用 7 種顏色的畫筆塗鴉、復原、隱藏。塗鴉會存在那一頁，下次再來還在。

想讓朋友也看到？架一台開源的小型塗鴉伺服器（設定頁有說明），連到同一台伺服器的人就能即時看到彼此的便利貼、塗鴉和游標。

• 可拖曳、換色、編輯的便利貼
• 可調粗細的手繪畫筆
• 即時多人模式，連游標都看得到（選用、自行架設）
• 隱私設計：伺服器只會收到網址的 SHA-256 雜湊值，絕不會收到網址本身
• 只有你能修改或刪除自己的作品
• 一鍵靜音任何人
• 匯出／匯入塗鴉

多人模式預設關閉。沒有設定伺服器時，所有資料都留在你的瀏覽器裡。
```
**Single purpose:** Lets users annotate web pages with sticky notes and drawings, optionally shared via a user-chosen server.
**Permission justifications**
- `storage`, `unlimitedStorage`: Save notes and drawings per page; drawings can exceed the default quota.
- Host permission (content script on http/https): Show the user's saved graffiti when they return to a page. The script stays idle on pages without graffiti.
- `activeTab`, `scripting`: Open the toolbar on tabs that were already open before installation.

**Data collected:** Website content (user-created notes/drawings and the page address they belong to) — stored locally. Sent only to a server the user configures, as a hash of the page address plus the user's own notes/drawings.

---

## 🏁 Wiki Race — 維基百科競速

**Category:** Fun (or Education)

**Description (EN)**
```
Get from one Wikipedia article to another using only links. Fastest wins.

• Pick start and target, roll random articles, or play today's challenge (the same pair for everyone)
• Timer, click counter and your path, right on the page
• The search box is hidden and only article links in the article body count
• Handles redirects, footnotes and the back button fairly
• Finish screen shows your full route
• "Copy challenge" makes a link: anyone with Wiki Race who opens it can race the same pair
• English, 中文, 日本語, Deutsch, Français, Español
• Race history

Runs only on wikipedia.org.
```
**描述（中文）**
```
只靠點連結，從一個維基百科條目跑到另一個。越快越好。

• 自訂起點與終點、隨機抽條目，或玩「今日挑戰」（大家同一題）
• 頁面上直接顯示計時、步數與路徑
• 比賽中搜尋列會被隱藏，只有條目內文裡的連結算數
• 正確處理重新導向、註腳與上一頁
• 抵達後顯示完整路線
• 「複製挑戰」產生連結，裝了 Wiki Race 的朋友打開就能挑戰同一題
• 支援英文、中文、日文、德文、法文、西班牙文維基百科
• 比賽紀錄

只在 wikipedia.org 上運作。
```
**Single purpose:** A timed link-navigation game on Wikipedia.
**Permission justifications**
- `storage`: Save the race in progress and race history.
- Host permission (`*.wikipedia.org`): Show the race HUD, hide search and check link clicks on Wikipedia pages only.

**Data collected:** none transmitted. (Requests go to Wikipedia's public API to validate article titles.)

---

## 🗡️ Page Dungeon — 網頁地城

**Category:** Fun

**Description (EN)**
```
Every web page is a dungeon. Go read it with a sword.

Click the icon (or Alt+Shift+D) and the page becomes a roguelike:
• Sections are floors, paragraphs are written on the walls of rooms
• Images are treasure chests, bold words are potions
• Links are portals: step in and press Enter to travel to that page's dungeon
• Ads and embeds are the toughest monsters; everything else is named after words on the page
• Same page, same dungeon, so you can compare runs with friends

Arrows / WASD / hjkl to move, bump to fight, Enter for stairs and portals, Esc to leave.
The extension can't see any page until you click its icon.
```
**描述（中文）**
```
每個網頁都是一座地城，帶把劍去讀它吧。

點圖示（或按 Alt+Shift+D），這頁就變成 roguelike：
• 章節是樓層，段落寫在房間牆上
• 圖片是寶箱，粗體字是藥水
• 連結是傳送門：踩上去按 Enter 就會前往那一頁的地城
• 廣告和嵌入內容是最強的怪物，其他怪物以頁面上的字命名
• 同一頁永遠生成同一座地城，可以跟朋友比

方向鍵／WASD／hjkl 移動，撞上去就是攻擊，Enter 走樓梯或傳送門，Esc 離開。
按下圖示之前，這個擴充功能看不到任何網頁。
```
**Single purpose:** Generates a playable roguelike game from the current page.
**Permission justifications**
- `activeTab`: Read the current page only after the user clicks the icon.
- `scripting`: Inject the game into that tab.

**Data collected:** none.

---

## 🎵 Page Symphony — 網頁交響曲

**Category:** Fun

**Description (EN)**
```
Every website has a theme song. Now you can hear it.

Page Symphony reads the page from top to bottom and plays it:
• Headings are chords, paragraphs are melodies (one note per word)
• Lists arpeggiate, links ding, images ring like bells, code chirps
• A beat underneath gets busier as the page goes on
• Each site gets its own key, mode and tempo
• The element being played lights up and the page scrolls along
• Record the whole song to a file and share it

All sound is generated live with Web Audio. Shortcut: Alt+Shift+M.
The extension can't see any page until you click its icon.
```
**描述（中文）**
```
每個網站都有主題曲，現在你聽得到了。

網頁交響曲從上到下讀完整頁，然後演奏它：
• 標題是和弦，段落是旋律（一個字一個音）
• 清單是琶音、連結叮一聲、圖片像鐘聲、程式碼嗶嗶叫
• 底下的節奏會隨著頁面越來越熱鬧
• 每個網站都有自己的調性、調式和速度
• 正在演奏的元素會發光，頁面跟著捲動
• 可以把整首歌錄成檔案分享

所有聲音都是用 Web Audio 即時合成。快捷鍵 Alt+Shift+M。
按下圖示之前，這個擴充功能看不到任何網頁。
```
**Single purpose:** Turns the current page's structure into generated music.
**Permission justifications**
- `activeTab`: Read the current page only after the user clicks the icon.
- `scripting`: Inject the music player into that tab.

**Data collected:** none.

---

## ⏳ Web Time Machine — 網頁時光機

**Category:** Fun

**Description (EN)**
```
Send any website back in time.

• 1995 Desktop: teal desktop, bevelled gray window, taskbar with a clock
• 1998 Homepage: starfield, rainbow headings, scrolling marquee, visitor counter, sparkle cursor, under-construction sign
• Green Terminal: phosphor glow, scanlines, tinted images, boot screen
• Amber Terminal: the warm version

📸 Snapshot saves a picture of the result. "Back to today" (or Shift+Esc) undoes everything.
The extension can't see any page until you click its icon.
```
**描述（中文）**
```
把任何網站送回過去。

• 1995 桌面：青綠色桌布、立體灰色視窗、有時鐘的工作列
• 1998 個人首頁：星空背景、彩虹標題、跑馬燈、訪客計數器、閃亮游標、施工中標誌
• 綠色終端機：螢光綠、掃描線、染色圖片、開機畫面
• 琥珀終端機：暖色版本

📸 快照可以存下結果。「回到今天」（或 Shift+Esc）一鍵還原。
按下圖示之前，這個擴充功能看不到任何網頁。
```
**Single purpose:** Applies retro visual themes to the current page.
**Permission justifications**
- `activeTab`: Restyle and capture the current tab only after the user opens the popup.
- `scripting`: Inject the theme styles into that tab.

**Data collected:** none.
