import { useEffect, useRef, useState } from 'react';
import { MascotAvatar } from './mascot-avatar';

type Character = 'doraemon' | 'shinchan';
export function RoamingMascot({ character, moving, expanded, mood, greeting, onActivate }: {
  character: Character; moving: boolean; expanded: boolean; mood: 'hello' | 'thinking' | 'talking'; greeting: number; onActivate: () => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const index = useRef(character === 'doraemon' ? 0 : 2);
  const button = useRef<HTMLButtonElement>(null);
  const name = character === 'doraemon' ? 'Doraemon' : 'Shin Chan';
  function clamp(x: number, y: number) { return { x: Math.max(4, Math.min(innerWidth - 100, x)), y: Math.max(12, Math.min(innerHeight - 220, y)) }; }
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update(); media.addEventListener('change', update);
    setPosition(clamp(innerWidth - (character === 'doraemon' ? 210 : 108), innerHeight - 245));
    const resize = () => setPosition(p => p ? clamp(p.x, p.y) : p); addEventListener('resize', resize);
    return () => { media.removeEventListener('change', update); removeEventListener('resize', resize); };
  }, [character]);
  useEffect(() => {
    if (!moving || expanded || dragging || reduced) {
      if (button.current && !dragging) { const box = button.current.getBoundingClientRect(); setPosition(clamp(box.x, box.y)); }
      return;
    }
    const timer = setInterval(() => {
      index.current = (index.current + 1) % 4;
      const points = [[.02, .2], [.77, .45], [.02, .62], [.77, .7]];
      const [x, y] = points[index.current];
      setPosition(clamp(innerWidth * x, innerHeight * y));
    }, character === 'doraemon' ? 13000 : 17000);
    return () => clearInterval(timer);
  }, [moving, expanded, dragging, reduced, character]);
  return <button ref={button} className={`roaming-pet ${dragging ? 'is-dragging' : ''}`} style={position ? { left: 0, top: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)` } : undefined}
    aria-label={`Hablar con ${name}`} aria-expanded={expanded} title={`${name}: arrástrame o tócame para conversar`}
    onPointerDown={e => { if (e.button !== 0) return; const box = e.currentTarget.getBoundingClientRect(); setPosition(clamp(box.x, box.y)); drag.current = { x: box.x, y: box.y, startX: e.clientX, startY: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }}
    onPointerMove={e => { const d = drag.current; if (!d) return; const dx = e.clientX - d.startX, dy = e.clientY - d.startY; if (Math.hypot(dx, dy) > 6) d.moved = true; if (d.moved) { const p = clamp(d.x + dx, d.y + dy); e.currentTarget.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`; } }}
    onPointerUp={e => { const d = drag.current; if (d?.moved) { const rect = e.currentTarget.getBoundingClientRect(); setPosition(clamp(rect.x, rect.y)); } suppressClick.current = Boolean(d?.moved); drag.current = null; setDragging(false); }}
    onPointerCancel={() => { drag.current = null; suppressClick.current = true; setDragging(false); }}
    onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onActivate(); }}
    onKeyDown={e => { const offsets: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }; const offset = offsets[e.key]; if (offset) { e.preventDefault(); setPosition(p => p ? clamp(p.x + offset[0], p.y + offset[1]) : p); } }}>
      <MascotAvatar key={`${character}-${greeting}`} character={character} animated mood={mood} />
      <span className="mascot-greeting">{character === 'doraemon' ? '¡Hola! ¿Cuidamos tu futuro?' : '¡Je, je! ¡Vamos juntos!'}</span>
  </button>;
}
