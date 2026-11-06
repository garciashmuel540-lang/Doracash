type Character = 'doraemon' | 'shinchan';
export function MascotAvatar({ character, animated = false, mood = 'hello' }: {
  character: Character; animated?: boolean; mood?: 'hello' | 'thinking' | 'talking';
}) {
  // One sprite and one shared texture: each frame stays fully visible.
  // CSS selects complete poses without fading or sliding between sheet cells.
  return <span className={`mascot-avatar ${character} ${animated ? 'mascot-animated' : ''}`} data-mood={mood} aria-hidden="true">
    <span className="mascot-sprite" />
  </span>;
}
