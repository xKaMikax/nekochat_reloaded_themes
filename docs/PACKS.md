# Cursors, sounds, icons and combos

Besides themes, the **Theme Browser** installs **packs**. There are four types:

| Type | What it changes | Folder in this repository |
|---|---|---|
| `cursors` | The mouse pointers | [`cursors/`](../cursors) |
| `sounds` | The sounds of the app (new message, calls, clicks…) | [`sounds/`](../sounds) |
| `icons` | The icons of the app's buttons and windows | [`icons/`](../icons) |
| `combo` | A list of items from this catalog: a theme and cursor, sound and icon packs | [`combos/`](../combos) |

People choose installed packs in **Display Properties**: sounds on the **Sounds** tab, cursors and icons on the **Display** tab.

A **combo** has no files of its own: it is an entry in `packs.json` that names a theme and packs **from this catalog**. Installing it installs each of them (skipping what is already installed); removing it removes them again. Its sounds, cursors and icons can be chosen like those of any pack.

## The pack archive

Each cursors, sounds or icons pack is a folder with three files:

```
sounds/my-sounds/
├── Pack.ZIP        the pack itself
├── Preview.png     picture shown in the catalog
└── Description.md  text shown in the catalog
```

Inside `Pack.ZIP`:

```
pack.json           name, author, type
sounds/             sound files (sounds packs)
cursors/            cursors.json + cursor files (cursors packs)
icons/              icons.json + pictures (icons packs)
```

Start from the [template](../template/pack).

### `pack.json`

```json
{ "name": "My sounds", "author": "Your name", "type": "sounds" }
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

## Combos

A combo is only a `packs.json` entry. `Includes` lists what it is made of, by the `theme_id` of
a theme in `themes.json` and the `pack_id` of packs in `packs.json`:

```json
{
  "pack_id": "zune-complete",
  "type": "combo",
  "DisplayName": "Zune — theme, cursors and sounds",
  "Includes": { "theme": "Zune", "cursors": "zune-cursors", "sounds": "zune-sounds" },
  "Details": { "Author": "Your name", "Version": "1.0", "Added": "2026-09-28" }
}
```

Any part can be left out. A combo can have a `Preview.png` and `Description.md` in `combos/<id>/`
(set `"directory": "combos/<id>"`), but it has no `Pack.ZIP`.

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
