import { MascotAvatar } from './mascot-avatar';

type Character = 'doraemon' | 'shinchan';
export function CornerMascot({ character, expanded, mood, onActivate }: {
  character: Character; expanded: boolean; mood: 'hello' | 'thinking' | 'talking'; onActivate: () => void;
}) {
  const name = character === 'doraemon' ? 'Doraemon' : 'Shin Chan';
  return <button className="corner-pet" aria-label={`Hablar con ${name}`} aria-expanded={expanded}
    title={`Toca a ${name} para conversar`} onClick={onActivate}>
    <MascotAvatar character={character} animated mood={mood} />
    <span className="mascot-greeting">{character === 'doraemon' ? '¡Hola! ¿Cuidamos tu futuro?' : '¡Je, je! ¡Vamos juntos!'}</span>
  </button>;
}
