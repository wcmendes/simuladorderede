// Terminal falso: input com histórico (↑/↓), Tab para completar,
// saída monoespaçada, impressão linha a linha com delay.
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { Line } from '../sim/types';
import { Clickable } from './Clickable';

export interface TermLine {
  id: number;
  text: string;
  kind: 'out' | 'hint' | 'err' | 'cmd';
}

export interface TerminalHandle {
  setInput: (v: string) => void;
  insertAtCursor: (v: string) => void;
  focus: () => void;
}

interface Props {
  prompt: string;
  lines: TermLine[];
  onSubmit: (cmd: string) => void;
  commandNames: string[]; // para o Tab
  onPickToken?: (token: string) => void;
  busy: boolean;
}

export const Terminal = forwardRef<TerminalHandle, Props>(function Terminal(
  { prompt, lines, onSubmit, commandNames, onPickToken, busy },
  ref,
) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setInput: (v) => {
      setInput(v);
      inputRef.current?.focus();
    },
    insertAtCursor: (v) => {
      const el = inputRef.current;
      if (!el) {
        setInput((cur) => cur + v);
        return;
      }
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? input.length;
      const next = input.slice(0, start) + v + input.slice(end);
      setInput(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + v.length;
        el.setSelectionRange(pos, pos);
      });
    },
    focus: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  function submit() {
    if (busy) return;
    const cmd = input;
    if (cmd.trim()) {
      setHistory((h) => [...h, cmd]);
    }
    setHistIdx(-1);
    setInput('');
    onSubmit(cmd);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(-1);
        setInput('');
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const word = input.trimStart();
      const matches = commandNames.filter((c) => c.startsWith(word.toLowerCase()));
      if (matches.length === 1) setInput(matches[0] + ' ');
    }
  }

  return (
    <div className="terminal" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
      {lines.map((l) => (
        <div key={l.id} className={l.kind === 'hint' ? 'line-hint' : l.kind === 'err' ? 'line-err' : undefined}>
          {l.kind === 'cmd' ? (
            <>
              <span className="prompt">{prompt}</span>
              {l.text}
            </>
          ) : (
            <Clickable text={l.text} onPick={onPickToken} />
          )}
        </div>
      ))}
      <div className="input-row">
        <span className="prompt">{prompt}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          aria-label="Linha de comando"
        />
      </div>
    </div>
  );
});

/** Converte as Line do motor em TermLine para exibição, respeitando os delays. */
export function expandLines(lines: Line[], baseId: number): { terms: TermLine[]; totalDelay: number } {
  let id = baseId;
  const terms: TermLine[] = lines.map((l) => ({
    id: id++,
    text: l.text,
    kind: (l.kind ?? 'out') as TermLine['kind'],
  }));
  const totalDelay = lines.reduce((a, l) => a + (l.delay ?? 0), 0);
  return { terms, totalDelay };
}
