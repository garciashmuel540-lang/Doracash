import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui";
import { DORAEMON_LOCALE, doraemonSpeechChunks, selectDoraemonVoice } from "@/lib/doraemon-speech";

const sample =
  "¡Hola! Soy Doraemon. Vamos a poner tus cuentas en orden. ¡En mi bolsillo siempre hay sitio para un buen plan!";

// Web Speech has one queue per page. Keep the two chat surfaces in sync.
let stopCurrentSpeech: (() => void) | undefined;

export function DoraemonVoice({ readReply }: { readReply?: () => string }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<() => void>(undefined);
  const utteranceRef = useRef<SpeechSynthesisUtterance>(undefined);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => stopRef.current?.();
  }, []);

  function toggleSpeech() {
    if (stopRef.current) {
      stopRef.current();
      return;
    }

    setError("");
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setError("Este navegador no admite la reproducción de voz.");
      return;
    }

    const voice = selectDoraemonVoice(synth.getVoices());
    if (!voice) {
      setError(
        "Activa una voz de Español (España) sin conexión en los ajustes de texto a voz de tu dispositivo y vuelve a intentarlo.",
      );
      return;
    }

    const chunks = doraemonSpeechChunks(readReply ? readReply() : sample);
    if (!chunks.length) return;

    stopCurrentSpeech?.();

    function finish() {
      if (stopCurrentSpeech !== stop) return;
      stopCurrentSpeech = undefined;
      stopRef.current = undefined;
      utteranceRef.current = undefined;
      setPlaying(false);
    }

    function stop() {
      finish();
      synth.cancel();
    }

    function playChunk(index: number) {
      if (stopCurrentSpeech !== stop) return;
      if (index === chunks.length) {
        finish();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = DORAEMON_LOCALE;
      utterance.voice = voice;
      utterance.pitch = 1.38;
      utterance.rate = 1.02;
      utterance.onend = () => playChunk(index + 1);
      utterance.onerror = () => {
        if (stopCurrentSpeech !== stop) return;
        finish();
        setError("No se pudo reproducir la voz. Vuelve a intentarlo.");
      };
      utteranceRef.current = utterance;
      synth.speak(utterance);
    }

    stopCurrentSpeech = stop;
    stopRef.current = stop;
    setPlaying(true);
    playChunk(0);
  }

  return (
    <div className="my-2">
      <Button variant="ghost" className="text-xs" onClick={toggleSpeech}>
        {playing ? (
          <Square className="size-4" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        )}
        {playing ? "Detener voz" : readReply ? "Escuchar a Doraemon" : "Probar voz de Doraemon"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-muted" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
