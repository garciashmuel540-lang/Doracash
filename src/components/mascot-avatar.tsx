type Character = 'doraemon' | 'shinchan';
export function MascotAvatar({ character, animated = false, mood = 'hello' }: {
  character: Character; animated?: boolean; mood?: 'hello' | 'thinking' | 'talking';
}) {
  return <span className={`mascot-avatar ${character} ${animated ? 'mascot-animated' : ''}`} data-mood={mood} aria-hidden="true"><span className="mascot-sprite" /></span>;
}
