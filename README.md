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
- **Text boxes:** drag them anywhere, double-click to edit, and set size and colour per box
- **Layering:** bring a text box to the front
- **Undo and redo:** up to 100 steps, covering drawing, moving, typing and styling
- **Autosave:** the board is restored when you come back, using your browser's local storage
- **Export and open:** save the board as a PNG image, or as a JSON file you can open again later
- **Mouse and touch:** works with a mouse, a stylus or a finger, on phones as well as large screens

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Delete the selected text box |
| <kbd>Esc</kbd> | Finish editing, or deselect |

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000. There's no build step and nothing to install, and it works offline.

## How it works

The board is stored as plain data: a list of text boxes and a list of drawings. Everything on screen is drawn from that data, with drawings on a `<canvas>` and text boxes as elements layered above it. Each change saves a snapshot of the data, which is what powers undo, redo, autosave and JSON export.

## Project structure

```
Interactive-white-board/
├── index.html    # Editor layout, icons, canvas and text layer
├── style.css     # Themes, editor layout and responsive rules
├── script.js     # Board data, drawing, text boxes, undo and saving
└── docs/         # Screenshot for this README
```

## License

[MIT](LICENSE)
