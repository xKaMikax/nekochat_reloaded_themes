# Cursors, sounds, icons and combos

Besides themes, the **Theme Browser** installs **packs**. There are four types:

| Type | What it changes | Folder in this repository |
|---|---|---|
| `cursors` | The mouse pointers | [`cursors/`](../cursors) |
| `sounds` | The sounds of the app (new message, calls, clicks…) | [`sounds/`](../sounds) |
| `icons` | The icons of the app's buttons and windows | [`icons/`](../icons) |
| `combo` | Any mix of the above, and optionally a theme | [`combos/`](../combos) |

People choose installed packs in **Display Properties**: sounds on the **Sounds** tab, cursors and icons on the **Display** tab. A combo installs everything it contains in one click; its theme appears among the installed themes.

## The pack archive

Each pack is a folder with three files:

```
sounds/my-sounds/
├── Pack.ZIP        the pack itself
├── Preview.png     picture shown in the catalog
└── Description.md  text shown in the catalog
```

Inside `Pack.ZIP`:

```
pack.json           name, author, type
sounds/             sound files (sounds and combo packs)
cursors/            cursors.json + cursor files (cursors and combo packs)
icons/              icons.json + pictures (icons and combo packs)
theme/              a theme, exactly like a Theme.ZIP (combo packs only)
```

Start from the [template](../template/pack).

### `pack.json`

```json
{ "name": "My pack", "author": "Your name", "type": "combo", "contains": ["sounds", "cursors"] }
```

### Sounds

Name each file after the event it plays for. `.wav` works everywhere; `.mp3` and `.ogg` work too. Leave out any sound to keep the app's own.

| File | When it plays |
|---|---|
| `notify.wav` | A new message |
| `ringin.wav` | An incoming call or voice channel invite (loops) |
| `ringout.wav` | Your outgoing call is ringing (loops) |
| `logon.wav` | Signing in |
| `logoff.wav` | Signing out |
| `navigation.wav` | A click on a button |
| `minimize.wav` | Minimizing a window |
| `default.wav` | An information message |
| `exclamation.wav` | A warning |
| `error.wav` | An error |
| `critical.wav` | A critical error |

### Cursors: `cursors/cursors.json`

Each entry names a pointer, its file and its hot spot (the pixel that points). Files can be `.cur` or `.png` (animated `.ani` cursors are not supported by the app's web engine; use the first frame as a `.png`).

```json
{
  "default": { "file": "arrow.cur", "x": 0, "y": 0 },
  "pointer": { "file": "hand.cur", "x": 6, "y": 0 },
  "text": { "file": "ibeam.cur", "x": 8, "y": 9 }
}
```

Pointer names: `default`, `pointer` (links and buttons), `text`, `wait`, `progress`, `not-allowed`, `help`, `crosshair`, `move`, `ew-resize`, `ns-resize`, `nwse-resize`, `nesw-resize`.

### Icons: `icons/icons.json`

Square PNG pictures, 32×32 or larger.

```json
{ "app": "app.png", "call": "call.png", "members": "members.png" }
```

Icon names: `app` (window icon), `personalize`, `change-user`, `sign-out`, `room` (rooms in the chat list), `add` (new chat), `call`, `members`, `notifications`.

## Publishing

Add your folder, then an entry to [`packs.json`](../packs.json):

```json
{
  "pack_id": "my-sounds",
  "type": "sounds",
  "directory": "sounds/my-sounds",
  "DisplayName": "My sounds",
  "Contains": ["sounds"],
  "Details": { "Author": "Your name", "Version": "1.0", "Added": "2026-09-28" }
}
```

`Added` is the date the pack was added. The catalog sorts by it, newest first.
