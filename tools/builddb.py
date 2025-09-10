from __future__ import annotations
import argparse
import json
import os
from typing import Dict, List


def insert(trie: Dict[str, dict], tokens: List[str]) -> None:
  node = trie
  for t in tokens:
    node = node.setdefault(t, {})


def build_trie_from_folder(folder: str) -> Dict[str, dict]:
  trie: Dict[str, dict] = {}
  if not os.path.isdir(folder):
    raise SystemExit(f"Folder not found: {folder}")

  seen = set()
  for name in os.listdir(folder):
    if not name.lower().endswith('.png'):
      continue
    stem = name[:-4] #remove file extension
    if not stem:
      continue
    if stem in seen:
      continue
    seen.add(stem)
    tokens = [t for t in stem.split('.') if t]
    if tokens:
      insert(trie, tokens)
  return trie


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument('--src', default=os.path.join('../', 'symbols'))
  parser.add_argument('--out', default=os.path.join('..', 'symbols.json'))
  args = parser.parse_args()

  trie = build_trie_from_folder(args.src)
  with open(args.out, 'w', encoding='utf-8') as f:
    json.dump(trie, f, indent=2, ensure_ascii=False)
  print(f"Wrote {args.out} with {len(trie)} top-level tokens.")


if __name__ == '__main__':
  main()
