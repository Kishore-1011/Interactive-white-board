// --- The board and what the user is doing ---

// The board is one list of items, ordered back to front. The page is always drawn from it.
// Text:     { id, type: 'text', text, x, y, width, fontSize, color, rotation, locked, groupId }
// Drawings: { id, type, points, color, strokeWidth, rotation, locked, groupId }
let items = [];

const elements = new Map();
let selectedIds = [];
let editingId = null;
let tool = 'select';
let nextId = 1;
let cascade = 0;

// Where the screen is looking: screen = board position * zoom + x/y offset.
const camera = { x: 0, y: 0, zoom: 1 };
let viewSaveTimer = null;

const settings = { grid: false, snap: true };

// What the pointer is doing right now, if anything.
let gesture = null;
let activeDrawing = null;
let eraser = null;
let lastTap = null;
let spaceHeld = false;
let pinch = null;
const touches = new Map();

let clipboard = [];
let pasteCount = 0;

// Each entry is a JSON snapshot of the board.
let undoStack = [];
let undoIndex = 0;
