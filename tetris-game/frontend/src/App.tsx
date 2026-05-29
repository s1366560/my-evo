import { useEffect, useRef, useState, useCallback } from 'react';
import {
  COLS, ROWS, BLOCK_SIZE, createEmptyBoard, randomPiece, rotate,
  isValid, lockPiece, clearLines, calculateScore, getDropSpeed, getGhostPosition,
  type Board, type Piece,
} from './tetris';
import { SidePanel } from './SidePanel';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);

  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState<Piece>(randomPiece);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [linesCleared, setLinesCleared] = useState(0);

  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPiece(randomPiece());
    setNextPiece(randomPiece());
    setScore(0);
    setLevel(0);
    setLinesCleared(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  // Drop piece down
  const drop = useCallback(() => {
    setBoard(prevBoard => {
      const moved: Piece = { ...currentPiece, pos: { ...currentPiece.pos, y: currentPiece.pos.y + 1 } };
      if (!isValid(prevBoard, moved)) {
        const locked = lockPiece(prevBoard, currentPiece);
        const { board: cleared, linesCleared: clearedLines } = clearLines(locked);
        if (cleared.some(row => row.every(cell => cell !== 0))) {
          setGameOver(true);
          return locked;
        }
        const newScore = score + calculateScore(clearedLines, level);
        const totalLines = linesCleared + clearedLines;
        const newLevel = Math.floor(totalLines / 10);
        setScore(newScore);
        setLinesCleared(totalLines);
        setLevel(newLevel);
        setCurrentPiece(nextPiece);
        setNextPiece(randomPiece());
        return cleared;
      }
      setCurrentPiece(moved);
      return prevBoard;
    });
  }, [currentPiece, nextPiece, score, level, linesCleared]);

  // Game loop timer
  useEffect(() => {
    if (gameOver || paused) {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const scheduleDrop = () => {
      timerRef.current = window.setTimeout(() => {
        drop();
        scheduleDrop();
      }, getDropSpeed(level));
    };
    scheduleDrop();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gameOver, paused, drop, level]);

  // Draw main board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = board[r][c];
        if (val) {
          drawBlock(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, val as string);
        }
      }
    }

    // Draw ghost piece
    if (!gameOver) {
      const ghost = getGhostPosition(board, currentPiece);
      ctx.globalAlpha = 0.3;
      for (let r = 0; r < ghost.shape.length; r++) {
        for (let c = 0; c < ghost.shape[r].length; c++) {
          if (ghost.shape[r][c]) {
            drawBlock(ctx, (ghost.pos.x + c) * BLOCK_SIZE, (ghost.pos.y + r) * BLOCK_SIZE, ghost.color);
          }
        }
      }
      ctx.globalAlpha = 1;

      // Draw current piece
      for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
          if (currentPiece.shape[r][c]) {
            drawBlock(ctx, (currentPiece.pos.x + c) * BLOCK_SIZE, (currentPiece.pos.y + r) * BLOCK_SIZE, currentPiece.color);
          }
        }
      }
    }
  }, [board, currentPiece, gameOver]);

  // Draw next piece preview
  useEffect(() => {
    const container = document.getElementById('next-piece-canvas');
    if (!container) return;
    
    // Create or reuse canvas
    let canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      container.appendChild(canvas);
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = nextPiece.shape.length * BLOCK_SIZE;
    const offsetX = (canvas.width - size) / 2;
    const offsetY = (canvas.height - size) / 2;

    for (let r = 0; r < nextPiece.shape.length; r++) {
      for (let c = 0; c < nextPiece.shape[r].length; c++) {
        if (nextPiece.shape[r][c]) {
          drawBlock(ctx, offsetX + c * BLOCK_SIZE, offsetY + r * BLOCK_SIZE, nextPiece.color);
        }
      }
    }
  }, [nextPiece]);

  function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const size = BLOCK_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 1, y + 1, size - 2, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 1, y + size - 5, size - 2, 4);
  }

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return;

      if (e.key === 'p' || e.key === 'P') {
        setPaused(p => !p);
        return;
      }
      if (paused) return;

      switch (e.key) {
        case 'ArrowLeft':
          move(-1, 0);
          break;
        case 'ArrowRight':
          move(1, 0);
          break;
        case 'ArrowDown':
          drop();
          break;
        case 'ArrowUp':
          rotatePiece();
          break;
        case ' ':
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPiece, board, gameOver, paused]);

  const move = (dx: number, dy: number) => {
    setCurrentPiece(prev => {
      const moved = { ...prev, pos: { ...prev.pos, x: prev.pos.x + dx, y: prev.pos.y + dy } };
      if (isValid(board, moved)) return moved;
      return prev;
    });
  };

  const rotatePiece = () => {
    setCurrentPiece(prev => {
      const rotated = { ...prev, shape: rotate(prev.shape) };
      if (isValid(board, rotated)) return rotated;
      // Wall kick - try shifting left/right
      const kickedLeft = { ...rotated, pos: { ...rotated.pos, x: rotated.pos.x - 1 } };
      if (isValid(board, kickedLeft)) return kickedLeft;
      const kickedRight = { ...rotated, pos: { ...rotated.pos, x: rotated.pos.x + 1 } };
      if (isValid(board, kickedRight)) return kickedRight;
      return prev;
    });
  };

  const hardDrop = () => {
    const ghost = getGhostPosition(board, currentPiece);
    setCurrentPiece(ghost);
    drop();
  };

  return (
    <>
      <div className="game-container">
        <div className="game-board">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
          />
          <div className="controls">
            <p>← → 移动 | ↑ 旋转 | ↓ 加速 | 空格 硬降 | P 暂停</p>
          </div>
        </div>
        <SidePanel
          score={score}
          level={level}
          linesCleared={linesCleared}
        />
      </div>

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-text">游戏结束</div>
          <p style={{ marginBottom: 20, fontSize: 18 }}>最终得分: {score}</p>
          <button className="play-button" onClick={startGame}>
            再来一局
          </button>
        </div>
      )}

      {paused && !gameOver && (
        <div className="pause-indicator">⏸ 已暂停 (按 P 继续)</div>
      )}
    </>
  );
}
