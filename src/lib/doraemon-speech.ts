export const DORAEMON_LOCALE = "es-ES";

const expressiveVoices = /\b(mónica|monica|helena|lucía|lucia|elvira|laura|marisol|female)\b/i;

export function selectDoraemonVoice(voices: readonly SpeechSynthesisVoice[]) {
  const localVoices = voices.filter(
    (voice) => voice.localService && voice.lang.toLowerCase().replaceAll("_", "-") === "es-es",
  );
  return (
    localVoices.find((voice) => expressiveVoices.test(voice.name)) ??
    localVoices.find((voice) => voice.default) ??
    localVoices[0]
  );
}

export function doraemonSpeechChunks(text: string): string[] {
  const chunks: string[] = [];
  const spoken = text.replace(/C\$\s*(\d+(?:[.,]\d+)*)/g, "$1 córdobas").trim();
  for (const sentence of spoken.split(/\n+|(?<=[.!?])\s+/)) {
    let chunk = "";
    for (const word of sentence.trim().split(/\s+/)) {
      if (chunk && chunk.length + 1 + word.length > 190) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk = chunk ? `${chunk} ${word}` : word;
    }
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
