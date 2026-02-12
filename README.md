# what's up Dug?

> *"I have just met your data and I LOVE it!"*

This is Dug. A good boy who sniffs around your [Harper](https://harper.fast/) instances. Full-screen terminal UI for exploring databases, tables, and records — completely read-only, because Dug is a good boy who doesn't chew on things.

## What dug does

- Sniffs through databases, tables, and individual records
- Fetches pages of data sized to your terminal (no more, no less)
- Builds queries with conditions, sorting, and limits
- Fuzzy-searches and picks columns
- Shows you schema details, indexes, and relationships
- Follows foreign keys between records (dug loves to chase things)
- Remembers where you've connected before
- Keeps a debug log when asked (via [snooplogg](https://www.npmjs.com/package/snooplogg), naturally)

## Install

```sh
npm install -g whats-up-dug
```

Or take dug for a walk without installing:

```sh
npx whats-up-dug
```

## Usage

```sh
# dug will ask where to sniff
dug

# point dug directly at something
dug --url http://localhost:9925 --user HDB_ADMIN -p password

# or use environment variables
export HARPER_URL=http://localhost:9925
export HARPER_USER=HDB_ADMIN
export HARPER_PASSWORD=password
dug
```

> Prefer environment variables over `-p` for passwords — CLI arguments are visible in process listings.

## Controls

dug responds to keyboard commands. He's a very trained boy.

**Everywhere:** `Esc` goes back, `q` `q` quits (double-tap so you don't leave by accident — dug doesn't want you to go).

**Browsing databases & tables**

| Key | What happens |
|-----|-------------|
| `j` / `k` | Move up/down |
| `Enter` | Go into it |
| `/` | Fuzzy filter |
| `i` | More info |
| `s` | System info |
| `r` | Sniff again (refresh) |

**Looking at table data**

| Key | What happens |
|-----|-------------|
| `j` / `k` | Move between rows |
| `Enter` | Look at this record |
| `n` / `p` | Next / previous page |
| `/` | Quick search |
| `f` | Query builder |
| `c` | Pick columns |
| `s` | Sort |
| `i` | Schema info |
| `r` | Sniff again |

**Inspecting a record**

| Key | What happens |
|-----|-------------|
| `j` / `k` | Scroll through fields |
| `Enter` | Follow a foreign key link |
| `y` | Copy JSON to clipboard |
| `PgUp` / `PgDn` | Scroll fast |

## Where dug keeps things

dug stashes a couple of files in `~/.dug/`:

- **`connections.json`** — recent connection URLs and usernames. Never passwords. dug can be trusted.
- **`debug.log`** — only created when you ask for it with `SNOOPLOGG` or `DEBUG` env vars.

## Debug logging

```sh
# dug tells you everything
SNOOPLOGG='dug:*' dug

# dug only talks about API calls
SNOOPLOGG='dug:api' dug
```

Namespaces: `dug:api`, `dug:app`, `dug:nav`, `dug:connect`

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
npm run build     # Build to dist/
npm run dev       # Run from source
npm run compile   # Build standalone binary
```

## License

MIT
