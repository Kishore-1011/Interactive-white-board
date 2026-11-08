# Interactive White Board

![HTML](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

**Live demo: https://kishore-1011.github.io/Interactive-white-board/**

A whiteboard that runs entirely in the browser. Sketch with a pen or shapes, place text anywhere, and pick up where you left off. There's no account and no server, and your board never leaves your device unless you export it.

![The whiteboard editor with a top bar, a tool rail and a floating options bar above a board of labelled shapes](docs/board.png)

## Features

- **Editor layout:** a tool rail on the left and a floating bar that shows only the options for what you've selected
- **Light and dark themes:** follows your system setting until you choose one, and the page stays white so it always matches your export
- **Named boards:** give the board a name and exported files use it
- **Drawing tools:** pen, line, rectangle and ellipse, with a colour picker and brush size
- **Eraser:** removes any stroke or shape it touches
- **Text:** double-click to edit, drag a corner to scale it, or drag a side to set where it wraps
- **Direct editing:** click anything to move, resize or rotate it with handles
- **Multiple selection:** drag across the board or Shift-click to work on several objects at once
- **Groups and locks:** group objects so they move together, and lock anything you don't want disturbed
- **Layers:** move any object forward, backward, to the front or to the back
- **Duplicate, copy and paste:** works on single objects and whole groups
- **Undo and redo:** up to 100 steps, covering every change to the board
- **Autosave:** the board is restored when you come back, using your browser's local storage
- **Snapping and guides:** objects snap to each other's edges and centres while you move or resize them, with guide lines showing what lines up
- **Align and distribute:** line up a selection or even out its spacing, with groups treated as single pieces
- **Optional grid:** show a grid that objects and shapes snap to
- **Large canvas:** pan in any direction, zoom from 10% to 400%, and fit everything on screen in one click
- **Export and open:** save the whole board as a PNG image, or as a JSON file you can open again later
- **Mouse and touch:** works with a mouse, a stylus or a finger, with pinch to zoom on phones and tablets

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd> | Copy, cut, paste |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplicate |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select everything that isn't locked |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> | Group |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Ungroup |
| <kbd>Ctrl</kbd> + <kbd>]</kbd> / <kbd>[</kbd> | Bring to front, send to back |
| <kbd>Ctrl</kbd> + scroll | Zoom at the pointer |
| <kbd>Ctrl</kbd> + <kbd>=</kbd> / <kbd>-</kbd> | Zoom in, zoom out |
| <kbd>Ctrl</kbd> + <kbd>0</kbd> | Reset to 100% |
| <kbd>Shift</kbd> + <kbd>1</kbd> | Fit everything on screen |
| Scroll, or hold <kbd>Space</kbd> and drag | Pan |
| <kbd>Ctrl</kbd> while moving, resizing or drawing | Skip snapping |
| <kbd>Shift</kbd> while resizing | Keep proportions |
| <kbd>Shift</kbd> while rotating | Snap to 15° steps |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Delete the selection |
| <kbd>Esc</kbd> | Finish editing, or deselect |

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000. There's no build step and nothing to install, and it works offline.

## How it works

The board is stored as plain data: one list of objects, ordered from back to front. Each object is drawn as its own element, using SVG for shapes and HTML for text, so the browser handles clicking on the exact stroke. Each change saves a snapshot of the list, which is what powers undo, redo, autosave and JSON export.

## Project structure

```
Interactive-white-board/
├── index.html              # Editor layout, icons and the order files load in
├── css/
│   ├── theme.css           # Colours for the light and dark themes
│   ├── base.css            # Page basics and icons
│   ├── buttons.css         # Shared button styles
│   ├── topbar.css          # Top bar and export menu
│   ├── layout.css          # Tool rail and work area
│   ├── board.css           # The board, objects, selection handles and guides
│   ├── panels.css          # Floating options, align menu, zoom controls and messages
│   ├── tooltips.css        # Tooltips
│   └── responsive.css      # Phone layout and reduced motion
├── js/
│   ├── dom.js              # References to page elements
│   ├── constants.js        # Fixed values such as limits and sizes
│   ├── state.js            # The board data and what the user is doing
│   ├── helpers.js          # Geometry and small shared functions
│   ├── shapes.js           # Drawing tools and the eraser
│   ├── render.js           # Drawing the page, undo and redo
│   ├── selection.js        # Selecting, layers, groups, locks and copy/paste
│   ├── text-editing.js     # Editing text in place
│   ├── transforms.js       # Moving, resizing, rotating and rubber-band selection
│   ├── snapping.js         # Snapping, guides, grid, align and distribute
│   ├── camera.js           # Panning, zooming and pinch
│   ├── preferences.js      # Board name, theme and menus
│   ├── storage.js          # Autosave, open, and PNG and JSON export
│   ├── input.js            # Mouse, touch, keyboard and button wiring
│   └── main.js             # Starts the app
└── docs/                   # Screenshot for this README
```

The scripts are plain files that share one scope and load in the order listed in `index.html`, so there's no build step and the page still works when opened directly from disk.

## License

[MIT](LICENSE)
