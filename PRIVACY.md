# Privacy Policy

_Last updated: October 24, 2026_

This policy covers all eight extensions in this repository: Typing Rampage, Page Physics, Tab Pet, Web Graffiti, Wiki Race, Page Dungeon, Page Symphony and Web Time Machine.

**Short version:** none of these extensions collect, sell or send your data anywhere. Everything stays in your browser, except Web Graffiti's optional multiplayer mode, which you have to turn on yourself by entering a server address.

## What is stored, and where

| Extension | Stored locally in your browser | Sent anywhere? |
|---|---|---|
| Typing Rampage | Settings, best combo, total keystroke **count** (never the keys or text) | No |
| Page Physics | Nothing | No |
| Tab Pet | Pet name, daily counters, settings, and the title + URL of up to 30 tabs it closed in snack mode, so you can reopen them | No |
| Web Graffiti | Your notes and drawings per page, the page address and title they belong to, your nickname, a random install secret | Only if you configure a server — see below |
| Wiki Race | Race history (articles, time, clicks) and language | Requests to Wikipedia's public API to check article names and pick random articles |
| Page Dungeon | Nothing | No |
| Page Symphony | Nothing (recordings are saved as files you download) | No |
| Web Time Machine | Nothing (snapshots are saved as files you download) | No |

Settings marked as "sync" use Chrome's own `chrome.storage.sync`, which Chrome may sync between your signed-in browsers. We never see it.

## Web Graffiti multiplayer

Multiplayer is **off by default**. If you enter a server address in the options page:

- The extension sends the server a **SHA-256 hash** of the page address (the page address itself is never sent), plus the notes, drawings, nickname and cursor positions you create on that page, so other people using the same server can see them.
- It sends a random secret generated at install; the server uses a hash of it as your author ID so only you can edit or delete what you made.
- By default it only contacts the server for pages where you open the graffiti toolbar. If you turn on "Look for other people's graffiti on every page", it sends the hash of every http(s) page you visit to that server.
- The server is software you (or someone you trust) run. Its operator is responsible for what it stores. The reference server in `web-graffiti/server` keeps only the notes and drawings, keyed by page hash and author ID, and no IP logs.

## Permissions

Permissions are used only for the features described in each extension's store listing. Extensions that use `activeTab` (Page Physics, Page Dungeon, Page Symphony, Web Time Machine) can only access a page after you click their icon on it.

## Contact

Open an issue on this repository.
