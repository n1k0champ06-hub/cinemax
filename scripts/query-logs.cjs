#!/usr/bin/env node
/**
 * scripts/query-logs.cjs
 * CLI tool to query, filter, and search cinemax-debug.log.
 * 
 * Usage:
 *   node scripts/query-logs.cjs [--level=ERROR] [--category=PLAYER] [-q "keyword"] [-n 50]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', 'cinemax-debug.log');

// ANSI color escapes
const colors = {
  reset: '\x1B[0m',
  bright: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  magenta: '\x1B[35m',
  cyan: '\x1B[36m',
  green: '\x1B[32m'
};

function printHelp() {
  console.log(`
${colors.bright}Cinemax Log Query Tool${colors.reset}

Usage:
  node scripts/query-logs.cjs [options]

Options:
  --level=<level>       Filter by log level: INFO, WARN, ERROR
  --category=<cat>      Filter by category: EDGE_WORKER, GEMINI_AI, PLAYER, NETWORK, SYSTEM
  -q, --query=<text>    Search logs for specific text (case-insensitive)
  -n, --limit=<number>  Limit the number of output logs (default: 100)
  -h, --help            Show this help menu
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    level: null,
    category: null,
    query: null,
    limit: 100
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('--level=')) {
      options.level = arg.split('=')[1].toUpperCase();
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1].toUpperCase();
    } else if (arg === '-q' || arg === '--query') {
      options.query = args[++i];
    } else if (arg.startsWith('--query=')) {
      options.query = arg.split('=')[1];
    } else if (arg === '-n' || arg === '--limit') {
      options.limit = parseInt(args[++i], 10);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
}

function main() {
  if (!fs.existsSync(logFilePath)) {
    console.log(`${colors.yellow}No log file found at ${logFilePath}.${colors.reset}`);
    return;
  }

  const options = parseArgs();
  const rawData = fs.readFileSync(logFilePath, 'utf-8');
  const lines = rawData.split('\n');
  const matchedLogs = [];

  // Parse pattern: [timestamp] [category] [level] message
  const logRegex = /^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)$/;

  for (const line of lines) {
    if (!line.trim()) continue;

    const match = line.match(logRegex);
    if (!match) {
      // If line format doesn't match standard regex, do basic query search if query specified
      if (options.query && !line.toLowerCase().includes(options.query.toLowerCase())) {
        continue;
      }
      matchedLogs.push({ raw: line });
      continue;
    }

    const [, timestamp, category, level, message] = match;

    // Apply filters
    if (options.level && level.toUpperCase() !== options.level) continue;
    if (options.category && category.toUpperCase() !== options.category) continue;
    if (options.query && !line.toLowerCase().includes(options.query.toLowerCase())) continue;

    matchedLogs.push({ timestamp, category, level, message, raw: line });
  }

  // Get the last N matching logs
  const limit = Math.max(1, options.limit);
  const logsToShow = matchedLogs.slice(-limit);

  console.log(`${colors.dim}Found ${matchedLogs.length} matching logs. Showing last ${logsToShow.length}.${colors.reset}\n`);

  for (const log of logsToShow) {
    if (!log.timestamp) {
      console.log(log.raw);
      continue;
    }

    // Color level
    let levelColor = colors.reset;
    if (log.level === 'ERROR') levelColor = colors.red + colors.bright;
    else if (log.level === 'WARN') levelColor = colors.yellow + colors.bright;
    else if (log.level === 'INFO') levelColor = colors.green;

    // Color category
    let catColor = colors.blue;
    if (log.category === 'EDGE_WORKER') catColor = colors.magenta;
    else if (log.category === 'GEMINI_AI') catColor = colors.cyan;
    else if (log.category === 'PLAYER') catColor = colors.yellow;

    console.log(
      `${colors.dim}[${log.timestamp}]${colors.reset} ` +
      `${catColor}[${log.category}]${colors.reset} ` +
      `${levelColor}[${log.level}]${colors.reset} ` +
      `${log.message}`
    );
  }
}

main();
