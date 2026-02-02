/**
 * Interactive Prompt Utilities
 *
 * Simple readline-based prompts for CLI interactive mode.
 */

import * as readline from 'readline';

interface SelectOption<T> {
    label: string;
    value: T;
}

/**
 * Create readline interface
 */
function createInterface(): readline.Interface {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

/**
 * Prompt for text input
 */
export function promptText(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = createInterface();
        rl.question(`${question} `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Prompt for selection from a list
 */
export async function promptSelect<T>(
    question: string,
    options: SelectOption<T>[]
): Promise<T> {
    console.log(`\n${question}`);
    options.forEach((opt, idx) => {
        console.log(`  ${idx + 1}. ${opt.label}`);
    });

    const rl = createInterface();

    return new Promise((resolve) => {
        const ask = () => {
            rl.question(`Enter choice (1-${options.length}): `, (answer) => {
                const choice = parseInt(answer.trim(), 10);
                if (choice >= 1 && choice <= options.length) {
                    rl.close();
                    resolve(options[choice - 1].value);
                } else {
                    console.log('Invalid choice. Please try again.');
                    ask();
                }
            });
        };
        ask();
    });
}

/**
 * Prompt for confirmation (yes/no)
 */
export function promptConfirm(question: string, defaultValue: boolean = true): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = createInterface();
        const hint = defaultValue ? '(Y/n)' : '(y/N)';
        rl.question(`${question} ${hint} `, (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            if (normalized === '') {
                resolve(defaultValue);
            } else {
                resolve(normalized === 'y' || normalized === 'yes');
            }
        });
    });
}
