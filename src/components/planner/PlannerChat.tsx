import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { usePlannerChat } from '../../contexts/PlannerChatContext';
import { useTasks } from '../../contexts/TaskContext';
import { useSheetItem } from '../../hooks/useSheetItem';
import { getDateString } from '../../lib/utils';
import { TaskDialog } from '../TaskDialog';
import type { Task } from '../../types';
import {
  PLANNER_COMPOSER_FOCUS_EVENT,
  PLANNER_UI_TEXT,
  type PlannerRescheduleRange,
} from '../../lib/navigation-constants';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import { formatDraftWhen, plannerCategoryColor } from '../../lib/planner-chat';
import { triggerSelectionHaptic } from '../../lib/native-haptics';
import { PlannerPriorityPill } from './PlannerPriorityPill';

const TEXT = PLANNER_UI_TEXT.chat;
const RANGES: PlannerRescheduleRange[] = ['day', 'week', 'month'];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function useDictation(onText: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const Recognition = getSpeechRecognition();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) onText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [Recognition, onText]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported: Recognition !== null, listening, start, stop };
}

export function PlannerChat({ className }: { className?: string }) {
  const {
    messages,
    drafts,
    busy,
    send,
    analyzeContext,
    acceptDraft,
    skipDraft,
    acceptAll,
    skipAll,
    reschedule,
    clear,
  } = usePlannerChat();
  const { tasks } = useTasks();
  const editor = useSheetItem<Task>();
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextRef = useRef<HTMLDetailsElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const appendDictation = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev}\n${text}` : text));
  }, []);
  const dictation = useDictation(appendDictation);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, drafts.length, busy]);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener(PLANNER_COMPOSER_FOCUS_EVENT, focus);
    return () => window.removeEventListener(PLANNER_COMPOSER_FOCUS_EVENT, focus);
  }, []);

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    void triggerSelectionHaptic();
    setInput('');
    await send(text);
  }, [busy, send]);

  const submitContext = () => {
    if (!context.trim()) return;
    analyzeContext(context);
    setContext('');
    if (contextRef.current) contextRef.current.open = false;
  };

  const lineCount = Math.min(
    PLANNER_LAYOUT.composerMaxRows,
    Math.max(PLANNER_LAYOUT.composerMinRows, input.split('\n').length),
  );
  const isEmpty = messages.length === 0 && drafts.length === 0;

  return (
    <section className={`planner-panel ${className ?? ''}`} aria-label={TEXT.title} data-tour="planner-chat">
      <header className="planner-header">
        <div className="min-w-0">
          <span className="planner-eyebrow">{TEXT.eyebrow}</span>
          <h2 className="planner-title">{TEXT.title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="planner-pill" disabled={busy}>
                <Icon name="refresh" size={PLANNER_LAYOUT.iconSmPx} />
                {TEXT.reschedule}
                <Icon name="chevron-down" size={PLANNER_LAYOUT.iconXsPx} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {RANGES.map((range) => (
                <DropdownMenuItem key={range} onSelect={() => void reschedule(range)}>
                  <span className="flex flex-col">
                    <span className="font-semibold">{TEXT.rescheduleOptions[range].label}</span>
                    <span className="text-xs text-muted-foreground">{TEXT.rescheduleOptions[range].hint}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!isEmpty ? (
            <button type="button" className="planner-icon-btn" aria-label={TEXT.clear} onClick={clear} disabled={busy}>
              <Icon name="trash" size={PLANNER_LAYOUT.iconMdPx} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="planner-scroll">
        <div className="planner-chat-body">
          {isEmpty ? (
            <div className="flex flex-col gap-3">
              <div className="planner-reply">
                <span className="planner-name">
                  <Icon name="sparkles" size={PLANNER_LAYOUT.iconXsPx} />
                  {TEXT.plannerName}
                </span>
                <p className="m-0 font-semibold">{TEXT.emptyTitle}</p>
                <p className="m-0 text-muted-foreground">{TEXT.emptyHint}</p>
              </div>
              <div className="planner-suggestions">
                {TEXT.suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" className="planner-pill" onClick={() => void submit(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((item) =>
            item.role === 'user' ? (
              <div key={item.id} className="planner-bubble">
                {item.text}
              </div>
            ) : (
              <div key={item.id} className="planner-reply">
                <span className="planner-name">
                  <Icon name="sparkles" size={PLANNER_LAYOUT.iconXsPx} />
                  {TEXT.plannerName}
                </span>
                <p className="m-0">{item.text}</p>
                {item.taskId && tasks.some((task) => task.id === item.taskId) ? (
                  <button
                    type="button"
                    className="planner-pill planner-reply-action"
                    onClick={() => {
                      const task = tasks.find((candidate) => candidate.id === item.taskId);
                      if (!task) return;
                      void triggerSelectionHaptic();
                      editor.show(task);
                    }}
                  >
                    <Icon name="external-link" size={PLANNER_LAYOUT.iconSmPx} />
                    {TEXT.openTask}
                  </button>
                ) : null}
              </div>
            ),
          )}

          {drafts.length > 0 ? (
            <div className="planner-drafts" aria-label={TEXT.draftsTitle}>
              <div className="flex items-center justify-between gap-2 pb-2">
                <span className="planner-eyebrow">{TEXT.draftsTitle}</span>
                <div className="flex gap-1">
                  <button type="button" className="planner-pill" onClick={skipAll} disabled={busy}>
                    {TEXT.skipAll}
                  </button>
                  <button type="button" className="planner-pill planner-pill--dark" onClick={() => void acceptAll()} disabled={busy}>
                    {TEXT.acceptAll}
                  </button>
                </div>
              </div>
              {drafts.map((draft) => (
                <div key={draft.id} className="planner-draft">
                  <div className="min-w-0">
                    <strong>{draft.title}</strong>
                    <small>
                      <PlannerPriorityPill priority={draft.priority} />
                      <span className="planner-dot" style={{ background: plannerCategoryColor(draft.category) }} />
                      {[draft.when ? formatDraftWhen(draft.when) : null, TEXT.estimate(draft.estimatedMinutes), draft.category].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className="planner-pill" onClick={() => skipDraft(draft.id)} disabled={busy}>
                      {TEXT.skip}
                    </button>
                    <button type="button" className="planner-pill planner-pill--dark" onClick={() => void acceptDraft(draft.id)} disabled={busy}>
                      {TEXT.accept}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {busy ? (
            <div className="planner-reply" aria-live="polite">
              <span className="planner-name">
                <Icon name="sparkles" size={PLANNER_LAYOUT.iconXsPx} />
                {TEXT.plannerName}
              </span>
              <span className="planner-typing" aria-label={TEXT.thinking}>
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="planner-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <details ref={contextRef}>
          <summary>
            <Icon name="plus" size={PLANNER_LAYOUT.iconXsPx} />
            {TEXT.addContext}
          </summary>
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder={TEXT.contextPlaceholder}
            aria-label={TEXT.addContext}
          />
          <button type="button" className="planner-pill mb-2" onClick={submitContext} disabled={!context.trim()}>
            <Icon name="sparkles" size={PLANNER_LAYOUT.iconXsPx} />
            {TEXT.analyzeContext}
          </button>
        </details>
        <div className="planner-composer-row">
          <textarea
            ref={inputRef}
            rows={lineCount}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit(input);
              }
            }}
            placeholder={TEXT.composerPlaceholder}
            aria-label={TEXT.composerPlaceholder}
            enterKeyHint="send"
          />
          {dictation.supported ? (
            <button
              type="button"
              className="planner-icon-btn planner-mic"
              data-listening={dictation.listening ? 'true' : undefined}
              aria-label={dictation.listening ? TEXT.voiceStop : TEXT.voiceStart}
              aria-pressed={dictation.listening}
              onClick={dictation.listening ? dictation.stop : dictation.start}
            >
              <Icon name="microphone" size={PLANNER_LAYOUT.iconPx} />
            </button>
          ) : null}
          <button type="submit" className="planner-send" aria-label={TEXT.send} disabled={!input.trim() || busy}>
            <Icon name="paper-plane-tilt" size={PLANNER_LAYOUT.iconPx} weight="fill" />
          </button>
        </div>
        <div className="planner-footer">{TEXT.footer}</div>
      </form>
      {editor.item ? (
        <TaskDialog open={editor.open} task={editor.item} onClose={editor.close} initialDate={getDateString(new Date())} />
      ) : null}
    </section>
  );
}
