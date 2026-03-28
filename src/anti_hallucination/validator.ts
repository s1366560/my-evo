/**
 * Validation Command Executor
 * Executes validation commands (syntax check, unit test, linter, etc.)
 * Chapter 28 Section 28.1
 */

import { spawn } from 'child_process';
import type { ValidationCommand, ValidationResult } from './types';

// Dangerous shell operators (chaining / injection patterns)
const DANGEROUS_PATTERNS = [
  /^;/, /\s;/, /^\|/, /\s\|/, /^&&/, /\s&&\s/, /^\|\|/, /\s\|\|\s/,
  /^>/, /^\</, /^\`/, /^\$\(/,
];

// Map signal name to number for exit code calculation (128 + signum)
function signalToNumber(signal: string): number {
  const signalMap: Record<string, number> = {
    'SIGHUP': 1, 'SIGINT': 2, 'SIGQUIT': 3, 'SIGILL': 4,
    'SIGTRAP': 5, 'SIGABRT': 6, 'SIGBUS': 7, 'SIGFPE': 8,
    'SIGKILL': 9, 'SIGUSR1': 10, 'SIGSEGV': 11, 'SIGUSR2': 12,
    'SIGPIPE': 13, 'SIGALRM': 14, 'SIGTERM': 15, 'SIGSTKFLT': 16,
    'SIGCHLD': 17, 'SIGCONT': 18, 'SIGSTOP': 19, 'SIGTSTP': 20,
    'SIGTTIN': 21, 'SIGTTOU': 22, 'SIGURG': 23, 'SIGXCPU': 24,
    'SIGXFSZ': 25, 'SIGVTALRM': 26, 'SIGPROF': 27, 'SIGWINCH': 28,
    'SIGIO': 29, 'SIGPWR': 30, 'SIGSYS': 31,
  };
  return signalMap[signal] ?? 128;
}

/**
 * Check if a command is safe to execute
 * Rejects commands with dangerous shell operators used for chaining/injection
 */
function isCommandSafe(command: string): boolean {
  const trimmed = command.trim();
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  return true;
}

export class ValidationExecutor {
  private static readonly DEFAULT_TIMEOUT_MS = 30000;

  /**
   * Execute a single validation command
   */
  async execute(command: ValidationCommand, workingDir?: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Security check: reject potentially dangerous commands
    if (!isCommandSafe(command.command)) {
      return {
        passed: false,
        type: command.type,
        output: '',
        error: `Command rejected: potentially unsafe shell operators detected: ${command.command}`,
        duration_ms: Date.now() - startTime,
        timestamp,
      };
    }

    try {
      const result = await this.runCommand(command.command, command.timeout_seconds * 1000, workingDir);

      return {
        passed: result.exitCode === 0,
        type: command.type,
        output: result.stdout,
        error: result.stderr || undefined,
        duration_ms: Date.now() - startTime,
        timestamp,
      };
    } catch (err) {
      return {
        passed: false,
        type: command.type,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startTime,
        timestamp,
      };
    }
  }

  /**
   * Execute multiple validation commands in parallel
   */
  async executeAll(commands: ValidationCommand[], workingDir?: string): Promise<ValidationResult[]> {
    return Promise.all(commands.map(cmd => this.execute(cmd, workingDir)));
  }

  /**
   * Execute a shell command with timeout
   */
  private runCommand(
    command: string,
    timeoutMs: number,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; signal?: string }> {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      // Wrap with timeout command on non-Windows for reliable timeout
      const useTimeout = process.platform !== 'win32';
      const timeoutSec = Math.ceil(timeoutMs / 1000);
      // Use --signal=KILL so timeout propagates SIGKILL to the child
      const wrappedCommand = useTimeout ? `timeout --signal=KILL ${timeoutSec} ${command}` : command;

      const proc = spawn(shell, [shellFlag, wrappedCommand], {
        cwd: cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let exitedWithSignal: string | undefined;

      // Fallback timer if timeout command isn't available or fails
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          process.kill(proc.pid!, 'SIGKILL');
        } catch {
          // ignore - process may have already exited
        }
      }, timeoutMs + 1000);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Track if process was killed by signal (e.g. SIGKILL from timeout)
      proc.on('exit', (code, signal) => {
        clearTimeout(timer);
        exitedWithSignal = signal ?? undefined;
        if (signal) {
          // Process was killed by a signal - this is a failure
          const signalNum = signalToNumber(signal);
          resolve({ stdout, stderr, exitCode: 128 + signalNum, signal });
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        // timeout command returns 124 on timeout, 127 on command not found
        if (code === 124 || timedOut) {
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        } else if (exitedWithSignal !== undefined) {
          // Already handled in 'exit' event
        } else {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(err);
        }
      });
    });
  }

  /**
   * Generate standard validation commands for a Gene
   * Falls back gracefully if optional tools are not available
   */
  static generateForGene(
    language: 'python' | 'typescript' | 'javascript' | 'bash',
    files?: string[]
  ): ValidationCommand[] {
    switch (language) {
      case 'python': {
        const commands: ValidationCommand[] = [
          {
            type: 'syntax',
            command: files
              ? `python -m py_compile ${files.join(' ')}`
              : 'python -m py_compile .',
            timeout_seconds: 10,
          },
        ];
        // pylint is optional - only add if files are specified
        if (files && files.length > 0) {
          commands.push({
            type: 'linter',
            command: `python -m pylint --errors-only ${files[0]}`,
            timeout_seconds: 20,
          });
        }
        return commands;
      }
      case 'typescript':
        // npx tools are optional - fall back to basic check
        return [
          { type: 'syntax', command: 'node --check', timeout_seconds: 5 },
          { type: 'linter', command: 'echo "tsc skipped - not installed"', timeout_seconds: 5 },
        ];
      case 'javascript':
        return [
          { type: 'syntax', command: 'node --check', timeout_seconds: 10 },
        ];
      case 'bash':
        return [
          { type: 'syntax', command: 'bash -n', timeout_seconds: 10 },
        ];
      default:
        return [];
    }
  }

  /**
   * Calculate overall validation status from multiple results
   */
  static aggregateResults(results: ValidationResult[]): { passed: boolean; score: number } {
    if (results.length === 0) {
      return { passed: true, score: 1.0 };
    }

    const passed = results.every(r => r.passed);
    const avgDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length;
    const maxDuration = Math.max(...results.map(r => r.duration_ms));

    // Score based on pass rate and relative duration
    const passRate = results.filter(r => r.passed).length / results.length;
    const durationScore = maxDuration > 0 ? Math.max(0, 1 - avgDuration / (maxDuration * 2)) : 1;

    return {
      passed,
      score: passRate * 0.8 + durationScore * 0.2,
    };
  }
}
