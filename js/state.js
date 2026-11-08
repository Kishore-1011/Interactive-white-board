// --- The board and what the user is doing ---

// The board is one list of items, ordered back to front. The page is always drawn from it.
// Every item also has: id, type, opacity, rotation, locked, groupId.
// Text:     text, x, y, width, height, fontSize, fontFamily, bold, align, color, fill, note
// Drawings: points, color, strokeWidth, fill (arrows also have startId, endId;
//           rectangles and ellipses also have text, fontSize, fontFamily, bold, align, textColor)
// Images:   assetId, x, y, w, h
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

let assetDb; // undefined while opening, null if IndexedDB isn't available.
let pendingAssetWrites = [];
let assetWriteFailed = false;
let assetLoadToken = 0;
let lastAssetLoad = Promise.resolve();
const assets = new Map();
let savedAssetKeys = null;
let currentFill = null;
let recentColors = [];
let paletteTarget = 'color';

let nudging = false;
let pasteFallbackTimer = null;

let clipboard = [];
let pasteCount = 0;

// Each entry is a JSON snapshot of the board.
let undoStack = [];
let undoIndex = 0;
