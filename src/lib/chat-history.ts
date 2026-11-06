export type ChatTurn = { role: 'user' | 'model'; text: string };

/** Keep conversational context bounded; current financial data is sent separately. */
export function recentChatHistory(turns: ChatTurn[]): ChatTurn[] {
  const recent = turns.slice(-6).map(turn => ({ ...turn, text: turn.text.slice(0, 2400) }));
  while (recent.length && recent[0].role !== 'user') recent.shift();
  return recent;
}
