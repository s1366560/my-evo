// Tetris game types and core constants

export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;

export type CellValue = 0 | string;
export type Board = CellValue[][];

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  shape: number[][];
  color: string;
  pos: Position;
}

// 7 standard tetromino types
export const TETROMINOES: Record<string, { shape: number[][]; color: string }> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: '#00f0f0',
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: '#f0f000',
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#a000f0',
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: '#00f000',
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: '#f00000',
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#0000f0',
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: '#f0a000',
  },
};

const PIECE_KEYS = Object.keys(TETROMINOES);

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as CellValue[]);
}

export function randomPiece(): Piece {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const t = TETROMINOES[key];
  return {
    shape: t.shape.map(row => [...row]),
    color: t.color,
    pos: { x: Math.floor((COLS - t.shape[0].length) / 2), y: 0 },
  };
}

export function rotate(shape: number[][]): number[][] {
  const N = shape.length;
  const rotated: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      rotated[c][N - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

export function isValid(board: Board, piece: Piece): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const newX = piece.pos.x + c;
        const newY = piece.pos.y + r;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
        if (newY >= 0 && board[newY][newX] !== 0) return false;
      }
    }
  }
  return true;
}

export function lockPiece(board: Board, piece: Piece): Board {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const y = piece.pos.y + r;
        const x = piece.pos.x + c;
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
          newBoard[y][x] = piece.color as CellValue;
        }
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter(row => row.some(cell => cell === 0));
  const linesCleared = ROWS - newBoard.length;
  while (newBoard.length < ROWS) {
    newBoard.unshift(Array(COLS).fill(0) as CellValue[]);
  }
  return { board: newBoard, linesCleared };
}

export function calculateScore(linesCleared: number, level: number): number {
  const linePoints: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };
  return (linePoints[linesCleared] || 0) * (level + 1);
}

export function getDropSpeed(level: number): number {
  return Math.max(100, 1000 - level * 100);
}

export function getGhostPosition(board: Board, piece: Piece): Piece {
  let ghost = { ...piece, pos: { ...piece.pos } };
  while (isValid(board, { ...ghost, pos: { ...ghost.pos, y: ghost.pos.y + 1 } })) {
    ghost.pos.y++;
  }
  return ghost;
}
