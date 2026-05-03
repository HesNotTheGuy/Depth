import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  method: string;
  startedAt: number;
}

interface SidecarResponse {
  id: string;
  result?: unknown;
  error?: string;
}

/**
 * Manages the depth_sidecar child process.
 *
 * Protocol: newline-delimited JSON.
 *   Request:  { id, method, params }
 *   Response: { id, result } | { id, error }
 *
 * Restarts on crash (with simple backoff).
 */
export class Sidecar {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, PendingRequest>();
  private buffer = '';
  private restartCount = 0;
  private stopped = false;

  constructor(private readonly binPath: string) {}

  start(): void {
    this.stopped = false;
    this.spawnProcess();
  }

  stop(): void {
    this.stopped = true;
    for (const [, req] of this.pending) {
      req.reject(new Error('sidecar_stopped'));
    }
    this.pending.clear();
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = null;
    }
  }

  isAlive(): boolean {
    return this.proc !== null && !this.proc.killed;
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.proc || this.proc.killed) {
        reject(new Error('sidecar_not_running'));
        return;
      }
      const id = randomUUID();
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        method,
        startedAt: Date.now(),
      });
      const payload = JSON.stringify({ id, method, params }) + '\n';
      try {
        this.proc.stdin.write(payload);
      } catch (err) {
        this.pending.delete(id);
        reject(err as Error);
      }
    });
  }

  private spawnProcess(): void {
    try {
      this.proc = spawn(this.binPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      console.error('[sidecar] spawn failed:', err);
      this.proc = null;
      return;
    }

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => this.onStdout(chunk));

    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (chunk: string) => {
      console.error('[sidecar:stderr]', chunk.trimEnd());
    });

    this.proc.on('exit', (code, signal) => {
      console.warn(`[sidecar] exited code=${code} signal=${signal}`);
      // Reject all pending requests.
      for (const [, req] of this.pending) {
        req.reject(new Error(`sidecar_exited code=${code}`));
      }
      this.pending.clear();
      this.proc = null;
      this.maybeRestart();
    });

    this.proc.on('error', (err) => {
      console.error('[sidecar] error:', err);
    });
  }

  private maybeRestart(): void {
    if (this.stopped) return;
    if (this.restartCount >= 5) {
      console.error('[sidecar] giving up after 5 restarts');
      return;
    }
    this.restartCount += 1;
    const delay = Math.min(1000 * this.restartCount, 5000);
    setTimeout(() => {
      if (!this.stopped) this.spawnProcess();
    }, delay);
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let msg: SidecarResponse;
    try {
      msg = JSON.parse(line) as SidecarResponse;
    } catch (err) {
      console.error('[sidecar] non-JSON line:', line);
      return;
    }
    if (!msg.id) {
      // Could be a log/event; ignore for now.
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }
}
