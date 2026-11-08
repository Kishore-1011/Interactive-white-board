// --- Fixed values ---

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'interactive-white-board';
const NAME_STORAGE_KEY = 'interactive-white-board:name';
const THEME_STORAGE_KEY = 'interactive-white-board:theme';
const VIEW_STORAGE_KEY = 'interactive-white-board:view';
const SETTINGS_STORAGE_KEY = 'interactive-white-board:settings';
const SNAP_DISTANCE = 6;
const GUIDE_TOLERANCE = 0.25;
const GRID_SIZE = 22;
const MENU_MARGIN = 8;
const MENU_GAP = 6;
const VIEW_SAVE_MS = 200;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const WHEEL_ZOOM_SPEED = 0.002;
const WHEEL_LINE_HEIGHT = 16;
const FIT_PADDING = 48;
const MIN_DOT_SPACING = 14;
const MAX_DOT_SPACING = 44;
const EXPORT_PADDING = 32;
const EXPORT_MAX_SIZE = 8000;
const MAX_TEXT_WIDTH = 1200;
const DEFAULT_BOARD_NAME = 'Untitled board';
const TOAST_MS = 3500;
const MAX_UNDO_STEPS = 100;
const CASCADE_START = 24;
const CASCADE_STEP = 28;
const CASCADE_LENGTH = 10;
const DRAG_THRESHOLD = 3;
const DOUBLE_TAP_MS = 350;
const ERASER_RADIUS = 8;
const ERASER_STEP = 4;
const ELLIPSE_SEGMENTS = 48;
const EXPORT_SCALE = 2;
const TEXT_PADDING = 5;
const HIT_PADDING = 12;
const MIN_RESIZE = 8;
const MIN_TEXT_WIDTH = 40;
const FLAT_SIZE = 1;
const ROTATE_SNAP = 15;
const ROTATE_HANDLE_ROOM = 34;
const PASTE_OFFSET = 24;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DRAWING_TYPES = ['pen', 'line', 'arrow', 'rectangle', 'ellipse'];
const FILLABLE_TYPES = ['rectangle', 'ellipse'];
const ASSETS_STORAGE_KEY = 'interactive-white-board:assets';
const RECENT_COLORS_STORAGE_KEY = 'interactive-white-board:recent-colors';
const BOARDS_STORAGE_KEY = 'interactive-white-board:boards';
const PARKED_BOARD_PREFIX = 'interactive-white-board:parked:';
const ACTIVE_BOARD_KEYS = [STORAGE_KEY, ASSETS_STORAGE_KEY, NAME_STORAGE_KEY, VIEW_STORAGE_KEY];
const PDF_PAGE_SIZE = 842;
const PDF_JPEG_QUALITY = 0.92;
const SECONDARY_TOOLS = ['line', 'arrow', 'rectangle', 'ellipse'];
const TOOL_KEYS = {
    v: 'select', h: 'hand', p: 'pen', e: 'eraser', l: 'line', a: 'arrow', r: 'rectangle', o: 'ellipse',
};
const SHAPE_TEXT_DEFAULTS = {
    text: '', fontSize: 20, fontFamily: 'sans', bold: false, align: 'center', textColor: '#111827',
};
const ASSET_DB_NAME = 'interactive-white-board';
const ASSET_STORE_NAME = 'assets';
const UNDO_TOAST_MS = 7000;
const MIN_LABEL_FONT = 10;
const ELLIPSE_TEXT_HEIGHT = 0.72;
const SHAPE_TEXT_PADDING = 6;
const ELLIPSE_TEXT_INSET = 0.14;
const NUDGE_SMALL = 1;
const NUDGE_LARGE = 10;
const NUDGE_VECTORS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const CLIPBOARD_MARKER = 'interactive-white-board-objects';
const PASTE_FALLBACK_MS = 60;
const ATTACH_MARGIN = 8;
const ATTACH_GAP = 6;
const ARROW_HEAD_MIN = 12;
const ARROW_HEAD_SCALE = 3.5;
const ARROW_HEAD_ANGLE = 0.45;
const NOTE_SIZE = 200;
const NOTE_FILL = '#fef08a';
const NOTE_TEXT_COLOR = '#1c1c21';
const NOTE_PADDING = 14;
const MIN_NOTE_SIZE = 60;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_SIZE = 1600;
const IMAGE_QUALITY = 0.85;
const IMAGE_PLACE_SIZE = 480;
const IMAGE_VIEW_SHARE = 0.6;
const ASSET_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i;
const MAX_RECENT_COLORS = 8;
const TEXT_ALIGNMENTS = ['left', 'center', 'right'];
const FONTS = {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", serif',
    mono: 'Consolas, Menlo, Monaco, "Courier New", monospace',
    hand: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    display: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
};
const PRESET_COLORS = [
    '#000000', '#475569', '#94a3b8', '#ffffff',
    '#dc2626', '#ea580c', '#f59e0b', '#fef08a',
    '#16a34a', '#0d9488', '#2563eb', '#4f46e5',
    '#7c3aed', '#c026d3', '#db2777', '#92400e',
];
const HANDLE_VECTORS = {
    nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
    se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};
