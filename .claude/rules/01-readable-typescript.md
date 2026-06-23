---
description: Write verbose, readable TypeScript that prioritizes clarity, explicit intent, and a Python-like coding style.
glob: "*.ts"
---

# Code Style: Readable, Pythonic TypeScript

Write code for humans first.

Optimize for:
- Readability
- Maintainability
- Explicit intent
- Ease of modification

Avoid writing code that is merely shorter.

## Naming

Use descriptive names.

Prefer:

```ts
const selectedFiles = files.filter(file => file.selected);
const totalDownloadSize = calculateTotalDownloadSize(files);
```

Over:

```ts
const s = files.filter(f => f.selected);
const t = calc(files);
```

Names should explain:
- what a value contains
- why it exists
- how it is used

Avoid unnecessary abbreviations.

---

## Functions

Functions should do one thing.

Prefer:

```ts
function getEnabledTrackers(trackers: Tracker[]): Tracker[] {
    return trackers.filter(tracker => tracker.enabled);
}
```

Over:

```ts
function process(trackers: Tracker[]) {
    // 50 lines doing 7 different things
}
```

Extract logic into well-named helpers whenever doing so improves readability.

---

## Prefer Expression-Oriented Code

Favor transformations over step-by-step mutation.

Prefer:

```ts
const activePeerAddresses = peers
    .filter(peer => peer.connected)
    .map(peer => peer.address);
```

Over:

```ts
const activePeerAddresses: string[] = [];

for (const peer of peers) {
    if (peer.connected) {
        activePeerAddresses.push(peer.address);
    }
}
```

The code should communicate *what* is happening, not *how*.

---

## Iteration

Prefer functional iteration methods:

```ts
map()
filter()
find()
reduce()
some()
every()
flatMap()
forEach()
```

Prefer:

```ts
const trackerUrls = trackers.map(tracker => tracker.url);
```

Over:

```ts
const trackerUrls: string[] = [];

for (const tracker of trackers) {
    trackerUrls.push(tracker.url);
}
```

Use loops only when they genuinely improve clarity.

---

## Object Operations

Prefer object-oriented transformations.

Use:

```ts
Object.entries()
Object.keys()
Object.values()
Object.fromEntries()
```

Prefer:

```ts
const enabledSettings = Object.fromEntries(
    Object.entries(settings)
        .filter(([, value]) => value.enabled)
);
```

Over manual property iteration.

---

## Immutability

Prefer immutable updates.

Use:

```ts
const updatedItems = items.with(index, newItem);
const filteredItems = items.toSpliced(index, 1);
```

Instead of mutating arrays directly.

Prefer:

```ts
return {
    ...torrent,
    progress: newProgress
};
```

Over:

```ts
torrent.progress = newProgress;
return torrent;
```

Mutation is acceptable when it clearly improves performance and the intent remains obvious.

---

## Early Returns

Avoid unnecessary nesting.

Prefer:

```ts
if (!torrent) {
    return;
}

if (!torrent.started) {
    return;
}

startDownload(torrent);
```

Over:

```ts
if (torrent) {
    if (torrent.started) {
        startDownload(torrent);
    }
}
```

Keep the happy path visible.

---

## Conditionals

Prefer positive conditions.

Prefer:

```ts
if (torrent.isComplete) {
    return;
}
```

Over:

```ts
if (!torrent.isComplete) {
    // large block
}
```

Reduce mental negation whenever possible.

---

## Destructuring

Use destructuring when it improves readability.

```ts
const { name, size, priority } = file;
```

Avoid excessive destructuring that obscures data origins.

---

## Intermediate Variables

Do not fear extra variables.

Prefer:

```ts
const selectedFiles = files.filter(file => file.selected);

const totalSelectedSize = selectedFiles.reduce(
    (totalSize, file) => totalSize + file.size,
    0
);
```

Over:

```ts
const totalSelectedSize = files
    .filter(file => file.selected)
    .reduce((a, b) => a + b.size, 0);
```

when intermediate names make the logic easier to understand.

---

## Nesting

Keep nesting shallow.

Extract helpers instead of creating pyramids.

Prefer:

```ts
const downloadableFiles = files.filter(isDownloadable);

return downloadableFiles.map(createDownloadTask);
```

Over deeply nested callbacks.

---

## Explicitness

Prefer code that explains itself.

Prefer:

```ts
const hasAnyHighPriorityFiles = files.some(
    file => file.priority === DownloadPriority.High
);
```

Over:

```ts
const hasHigh = files.some(f => f.priority === 7);
```

Magic numbers and cryptic values should be replaced with named constants.

---

## Comments

Use comments to explain *why*.

Avoid comments that explain *what*.

Good:

```ts
// Metadata may be incomplete while magnet resolution is in progress.
```

Bad:

```ts
// Increment index by one.
index++;
```

Well-written code should explain itself.

---

## TypeScript

Prefer explicit types for public APIs.

```ts
function getTorrentInfo(hash: string): TorrentInfo {
    ...
}
```

Allow local inference when the type is obvious.

```ts
const trackerCount = trackers.length;
```

Do not add redundant type annotations.

---

## Readability Rules

When choosing between:
- shorter vs clearer
- clever vs obvious
- compact vs explicit

Always choose:

- clearer
- more explicit
- easier to modify
- easier to debug

Future maintainers should understand the code without needing to mentally execute it.

Write TypeScript as if it were clean Python with static types.
