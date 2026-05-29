interface SidePanelProps {
  score: number;
  level: number;
  linesCleared: number;
}

export function SidePanel({ score, level, linesCleared }: SidePanelProps) {
  return (
    <div className="side-panel">
      <div className="panel">
        <h3>得分</h3>
        <div className="score-value">{score.toLocaleString()}</div>
      </div>
      <div className="panel">
        <h3>等级</h3>
        <div className="level-value">{level}</div>
      </div>
      <div className="panel">
        <h3>消除行数</h3>
        <div className="level-value">{linesCleared}</div>
      </div>
      <div className="panel">
        <h3>下一个</h3>
        <div className="next-preview" id="next-piece-canvas" />
      </div>
    </div>
  );
}
