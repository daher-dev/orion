#!/usr/bin/env tsx
/**
 * i18n lint — assert that en.json and pt-BR.json have identical key sets.
 *
 * Usage: pnpm i18n:lint
 *
 * Exit codes:
 *  0  — both locales agree on every dot-path
 *  1  — at least one key is missing in one locale
 *  2  — JSON parse error or filesystem error
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MESSAGES_DIR = resolve(process.cwd(), "messages");

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

function loadMessages(locale: string): Record<string, Json> {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    console.error(`[i18n-lint] Could not read ${path}: ${(err as Error).message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw) as Record<string, Json>;
  } catch (err) {
    console.error(`[i18n-lint] Invalid JSON in ${path}: ${(err as Error).message}`);
    process.exit(2);
  }
}

function flatten(obj: Json, prefix = ""): Set<string> {
  const out = new Set<string>();
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix) out.add(prefix);
    return out;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    // Treat empty object stubs as a "namespace exists" marker so feature
    // namespaces declared in foundation don't appear missing.
    if (prefix) out.add(`${prefix}.__namespace__`);
    return out;
  }
  for (const [key, value] of entries) {
    const next = prefix ? `${prefix}.${key}` : key;
    for (const path of flatten(value, next)) out.add(path);
  }
  return out;
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return Array.from(a).filter((x) => !b.has(x)).sort();
}

function main(): void {
  const en = flatten(loadMessages("en"));
  const ptBR = flatten(loadMessages("pt-BR"));

  const missingInPtBr = diff(en, ptBR);
  const missingInEn = diff(ptBR, en);

  if (missingInPtBr.length === 0 && missingInEn.length === 0) {
    console.log(`[i18n-lint] OK — ${en.size} keys present in both locales.`);
    process.exit(0);
  }

  if (missingInPtBr.length > 0) {
    console.error(`[i18n-lint] Missing in pt-BR (${missingInPtBr.length}):`);
    for (const k of missingInPtBr) console.error(`  - ${k}`);
  }
  if (missingInEn.length > 0) {
    console.error(`[i18n-lint] Missing in en (${missingInEn.length}):`);
    for (const k of missingInEn) console.error(`  - ${k}`);
  }
  process.exit(1);
}

main();
