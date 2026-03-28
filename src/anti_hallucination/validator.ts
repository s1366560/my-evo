/**
 * Validation Command Executor
 * Executes validation commands (syntax check, unit test, linter, etc.)
 * Chapter 28 Section 28.1
 */

import { spawn } from 'child_process';
import type { ValidationCommand, ValidationResult, ValidationType } from './types';

export class ValidationExecutor {
  private static readonly DEFAULT_TIMEOUT_MS = 30000;

  /**
   * Execute a single validation command
   */
  async execute(command: ValidationCommand, workingDir?: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

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
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      // Wrap with timeout command on non-Windows for reliable timeout
      const useTimeout = process.platform !== 'win32';
      const timeoutSec = Math.ceil(timeoutMs / 1000);
      const wrappedCommand = useTimeout ? `timeout ${timeoutSec} ${command}` : command;

      const proc = spawn(shell, [shellFlag, wrappedCommand], {
        cwd: cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

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

      proc.on('close', (code) => {
        clearTimeout(timer);
        // timeout command returns 124 on timeout, 127 on command not found
        if (code === 124 || timedOut) {
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
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
   */
  static generateForGene(
    language: 'python' | 'typescript' | 'javascript' | 'bash',
    files?: string[]
  ): ValidationCommand[] {
    switch (language) {
      case 'python':
        return [
          { type: 'syntax', command: files ? `python -m py_compile ${files.join(' ')}` : 'python -m py_compile *.py', timeout_seconds: 10 },
          ...(files ? files.map(f => ({ type: 'linter' as const, command: `python -m pylint --errors-only ${f}`, timeout_seconds: 20 })) : []),
        ];
      case 'typescript':
        return [
          { type: 'syntax', command: 'npx tsc --noEmit', timeout_seconds: 30 },
          { type: 'linter', command: 'npx eslint src --ext .ts', timeout_seconds: 30 },
        ];
      case 'javascript':
        return [
          { type: 'syntax', command: 'node --check *.js', timeout_seconds: 10 },
        ];
      case 'bash':
        return [
          { type: 'syntax', command: 'bash -n *.sh', timeout_seconds: 10 },
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
