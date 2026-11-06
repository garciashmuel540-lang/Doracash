type Character = 'doraemon' | 'shinchan';
export function MascotAvatar({ character, animated = false, mood = 'hello' }: {
  character: Character; animated?: boolean; mood?: 'hello' | 'thinking' | 'talking';
}) {
  // Keep one opaque greeting pose mounted. Cross-fading different silhouettes
  // produces ghosting and flashes; continuous transforms preserve the artwork.
  const backgroundPosition = `${animated ? '66.6667%' : '0%'} ${character === 'shinchan' ? 'calc(66.6667% + 4px)' : '0%'}`;
  return <span className={`mascot-avatar ${character} ${animated ? 'mascot-animated' : ''}`} data-mood={mood} aria-hidden="true">
    <span className="mascot-sprite" style={{ backgroundPosition }} />
  </span>;
}
