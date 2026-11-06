export function MascotAvatar({ character }: { character: 'doraemon' | 'shinchan' }) {
  return <span className={`mascot-avatar ${character}`} aria-hidden="true">
    <span className="mascot-body" /><span className="mascot-head">
      <span className="mascot-face" /><span className="mascot-eye left" /><span className="mascot-eye right" />
      <span className="mascot-nose" /><span className="mascot-mouth" />
      {character === 'doraemon' ? <><span className="mascot-whiskers left" /><span className="mascot-whiskers right" /></> : <><span className="mascot-brow left" /><span className="mascot-brow right" /></>}
    </span><span className="mascot-bell" /><span className="mascot-hand left" /><span className="mascot-hand right" />
  </span>;
}
