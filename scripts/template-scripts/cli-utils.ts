/**
 * CLI Utilities
 * 
 * Provides keyboard-navigable prompts for better UX.
 */

import * as readline from 'readline';

export interface SelectOption<T> {
  label: string;
  value: T;
  description?: string;
}

/**
 * Display a keyboard-navigable select menu.
 * - Arrow Up/Down or j/k: Navigate options
 * - Enter or Space: Select current option
 * - Number keys: Quick select (1-9)
 * - q or Escape: Cancel (returns null)
 */
export async function select<T>(
  message: string,
  options: SelectOption<T>[],
  defaultIndex = 0
): Promise<T | null> {
  return new Promise((resolve) => {
    let selectedIndex = defaultIndex;
    const maxIndex = options.length - 1;
    let totalLinesRendered = 0;

    // Enable raw mode for keypress detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);

    // Calculate total lines this menu will take
    const calculateLines = (): number => {
      let lines = 2; // message + blank line
      for (const opt of options) {
        lines += 1; // label line
        if (opt.description) {
          lines += 1; // description line
        }
      }
      lines += 2; // blank line + hint line
      return lines;
    };

    const clearLines = (count: number) => {
      if (count > 0) {
        // Move cursor up and clear each line
        for (let i = 0; i < count; i++) {
          process.stdout.write('\x1b[1A'); // Move up one line
          process.stdout.write('\x1b[2K'); // Clear entire line
        }
      }
    };

    const render = (isInitial = false) => {
      // Clear previous render if not initial
      if (!isInitial && totalLinesRendered > 0) {
        clearLines(totalLinesRendered);
      }

      const lines: string[] = [];
      
      lines.push(message);
      lines.push('');
      
      options.forEach((opt, i) => {
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? '\x1b[36m❯\x1b[0m' : ' ';
        const highlight = isSelected ? '\x1b[36m\x1b[1m' : '\x1b[90m';
        const reset = '\x1b[0m';
        const number = `[${i + 1}]`;
        
        lines.push(`${prefix} ${highlight}${number} ${opt.label}${reset}`);
        if (opt.description) {
          lines.push(`    \x1b[90m${opt.description}\x1b[0m`);
        }
      });
      
      lines.push('');
      lines.push('\x1b[90m↑/↓ navigate • Enter select • q cancel\x1b[0m');

      // Add initial blank line only on first render (printed separately to not affect line count)
      if (isInitial) {
        console.log('');
      }
      
      // Print all lines
      lines.forEach(line => console.log(line));
      
      totalLinesRendered = lines.length;
    };

    // Initial render
    render(true);

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onKeypress = (_: string, key: readline.Key) => {
      if (!key) return;

      // Handle arrow keys and vim-style navigation
      if (key.name === 'up' || key.name === 'k') {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : maxIndex;
        render();
      } else if (key.name === 'down' || key.name === 'j') {
        selectedIndex = selectedIndex < maxIndex ? selectedIndex + 1 : 0;
        render();
      } 
      // Handle Enter/Space to select
      else if (key.name === 'return' || key.name === 'space') {
        cleanup();
        // Clear the menu and show selection
        clearLines(totalLinesRendered);
        console.log(`\n${message}`);
        console.log(`✓ ${options[selectedIndex].label}\n`);
        resolve(options[selectedIndex].value);
      }
      // Handle number keys (1-9)
      else if (key.name && /^[1-9]$/.test(key.name)) {
        const index = parseInt(key.name) - 1;
        if (index <= maxIndex) {
          cleanup();
          clearLines(totalLinesRendered);
          console.log(`\n${message}`);
          console.log(`✓ ${options[index].label}\n`);
          resolve(options[index].value);
        }
      }
      // Handle cancel (q or Escape)
      else if (key.name === 'q' || key.name === 'escape') {
        cleanup();
        clearLines(totalLinesRendered);
        console.log(`\n${message}`);
        console.log('✗ Cancelled\n');
        resolve(null);
      }
      // Handle Ctrl+C
      else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Display a simple yes/no confirmation prompt.
 * - y/Enter: Yes
 * - n/q/Escape: No
 */
export async function confirm(message: string, defaultValue = true): Promise<boolean> {
  return new Promise((resolve) => {
    const hint = defaultValue ? '[Y/n]' : '[y/N]';
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);

    process.stdout.write(`\n${message} ${hint} `);

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onKeypress = (_: string, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'y') {
        cleanup();
        console.log('Yes\n');
        resolve(true);
      } else if (key.name === 'n' || key.name === 'q' || key.name === 'escape') {
        cleanup();
        console.log('No\n');
        resolve(false);
      } else if (key.name === 'return') {
        cleanup();
        console.log(defaultValue ? 'Yes' : 'No');
        console.log('');
        resolve(defaultValue);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Fallback to readline-based input for non-TTY environments
 */
export function createFallbackSelect<T>(rl: readline.Interface) {
  return async (message: string, options: SelectOption<T>[]): Promise<T | null> => {
    console.log(`\n${message}\n`);
    options.forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label}`);
      if (opt.description) {
        console.log(`      ${opt.description}`);
      }
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice: ', (answer) => {
        const index = parseInt(answer.trim()) - 1;
        if (index >= 0 && index < options.length) {
          resolve(options[index].value);
        } else {
          resolve(null);
        }
      });
    });
  };
}

/**
 * Check if terminal supports interactive mode
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}
