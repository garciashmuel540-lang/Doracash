import type { CSSProperties } from 'react';
type Character = 'doraemon' | 'shinchan';
export function MascotAvatar({ character, animated = false, mood = 'hello' }: {
  character: Character; animated?: boolean; mood?: 'hello' | 'thinking' | 'talking';
}) {
  const positions = ['0%', '33.3333%', '66.6667%', '100%'];
  return <span className={`mascot-avatar ${character} ${animated ? 'mascot-animated' : ''}`} data-mood={mood} aria-hidden="true">
    {Array.from({ length: animated ? 8 : 1 }, (_, frame) => {
      const row = Math.floor(frame / 4) + (character === 'shinchan' ? 2 : 0);
      const y = row === 0 ? '0%' : `calc(${positions[row]} + ${row === 1 ? 2 : 4}px)`;
      return <span key={frame} className={`mascot-sprite mascot-frame frame-${frame}`} style={{ backgroundPosition: `${positions[frame % 4]} ${y}`, '--pose-delay': `${(frame - 8) * .4}s` } as CSSProperties} />;
    })}
  </span>;
}
