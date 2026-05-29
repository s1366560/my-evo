import { COLS, ROWS, BLOCK_SIZE } from './tetris';

interface GameBoardProps {
  width?: number;
  height?: number;
}

export function GameBoard({ width = COLS * BLOCK_SIZE, height = ROWS * BLOCK_SIZE }: GameBoardProps) {
  return (
    <canvas
      style={{ display: 'block' }}
      width={width}
      height={height}
    />
  );
}
