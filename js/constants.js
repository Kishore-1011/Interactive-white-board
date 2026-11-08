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
const DRAWING_TYPES = ['pen', 'line', 'rectangle', 'ellipse'];
const HANDLE_VECTORS = {
    nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
    se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};
