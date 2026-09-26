import { useEffect, useRef, useState } from 'react';
import { copyText } from './clipboard';

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
  disabled?: boolean;
  onCopied?: (ok: boolean) => void;
  testId?: string;
}

/** A button that copies `text` and briefly confirms in place. */
export function CopyButton({ text, label, className = 'btn', disabled, onCopied, testId }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      data-testid={testId}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'copied' : 'failed');
        onCopied?.(ok);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState('idle'), 1600);
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}
