#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { HarperClient } from './api/client.js';
import { App } from './app.js';
import type { ScreenName } from './hooks/use-navigation.js';
import { app as log } from './logger.js';

// Enter alternate screen buffer (like vim/lazygit)
function enterAltScreen() {
  process.stdout.write('\x1b[?1049h'); // switch to alt buffer
  process.stdout.write('\x1b[H');      // move cursor to top-left
}

function exitAltScreen() {
  process.stdout.write('\x1b[?1049l'); // restore original buffer
}

const program = new Command();

program
  .name('dug')
  .description('Interactive data exploration CLI for Harper')
  .version('0.1.0')
  .option('-u, --url <url>', 'Harper instance URL', process.env.HARPER_URL)
  .option('--user <username>', 'Username', process.env.HARPER_USER)
  .option('-p, --password <password>', 'Password', process.env.HARPER_PASSWORD)
  .option('--whats-up', 'what\'s up Dug?')
  .action(async (opts) => {
    if (opts.whatsUp) {
      program.help();
      return;
    }
    log.info('dug starting');
    const client = new HarperClient();
    let initialScreen: ScreenName = 'connect';

    const url = opts.url;
    const user = opts.user;
    const password = opts.password;

    // Auto-connect if all credentials provided
    if (url && user && password) {
      log.info('Auto-connecting to %s', url);
      try {
        await client.connect(url, user, password);
        initialScreen = 'dashboard';
      } catch (err: any) {
        log.error('Auto-connect failed: %s', err.message);
        // Fall through to connect screen with pre-filled values
        console.error(`Connection failed: ${err.message}`);
        console.error('Starting in connect mode...\n');
      }
    }

    enterAltScreen();

    // Restore terminal on exit
    process.on('exit', exitAltScreen);
    process.on('SIGINT', () => { exitAltScreen(); process.exit(0); });
    process.on('SIGTERM', () => { exitAltScreen(); process.exit(0); });

    render(
      <App
        client={client}
        initialScreen={initialScreen}
        initialUrl={url}
        initialUser={user}
        initialPassword={password}
      />,
    );
  });

program.parse();
