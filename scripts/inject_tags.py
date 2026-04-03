#!/usr/bin/env python3
"""
Minimal surgical tag injection for Fastify route files.
For each route call:
  - If 'tags:' already present → skip
  - If 'schema:' exists → insert tags inside the schema block
  - Otherwise → insert 'schema: { tags: ["TAG"] }' as a separate route argument
"""

import sys
import re
from pathlib import Path

TAG_MAP = {
    'src/a2a/routes.ts':              'A2A',
    'src/assets/routes.ts':              'Assets',
    'src/credits/routes.ts':            'Credits',
    'src/reputation/routes.ts':          'Reputation',
    'src/swarm/routes.ts':              'Swarm',
    'src/workerpool/routes.ts':         'Swarm',
    'src/bounty/routes.ts':             'Bounty',
    'src/council/routes.ts':            'Council',
    'src/verifiable_trust/routes.ts':    'Trust',
    'src/community/routes.ts':           'Community',
    'src/session/routes.ts':            'Session',
    'src/analytics/routes.ts':          'Analytics',
    'src/biology/routes.ts':            'Biology',
    'src/marketplace/routes.ts':         'Marketplace',
    'src/quarantine/routes.ts':          'Quarantine',
    'src/driftbottle/routes.ts':        'DriftBottle',
    'src/circle/routes.ts':              'Circle',
    'src/kg/routes.ts':                 'KnowledgeGraph',
    'src/arena/routes.ts':              'Arena',
    'src/account/routes.ts':            'Account',
    'src/search/routes.ts':             'Search',
}

# Matches the opening of a Fastify route call
ROUTE_START = re.compile(r"^(\s*)(app)\.(get|post|put|patch|delete)\s*\(")


def get_indent(line: str) -> str:
    return line[:len(line) - len(line.lstrip())]


def route_end_index(lines, start: int, n: int) -> int | None:
    """
    Find the last line of a route call starting at `start`.
    A route ends at the line that contains '});'.
    Returns the line index, or None if not found.
    """
    for k in range(start, n):
        if lines[k].rstrip().endswith('});'):
            return k
    return None


def has_schema_in_options(block: list[str]) -> bool:
    """
    Check if block has 'schema:' as a top-level options property.
    Only searches lines up to (but not including) a line ending with '},'
    (the options object boundary), avoiding handler body matches.
    """
    for l in block:
        stripped = l.lstrip()
        # Must be the first non-whitespace content on the line
        if stripped.startswith('schema:'):
            return True
    return False


def has_tags_in_options(block: list[str]) -> bool:
    """Check if block has 'tags:' as a top-level options property."""
    for l in block:
        stripped = l.lstrip()
        if stripped.startswith('tags:'):
            return True
    return False


def find_async_line(lines, start: int, end: int) -> int | None:
    """Find the first line in [start, end) that starts with 'async'."""
    for k in range(start, end):
        if lines[k].lstrip().startswith('async'):
            return k
    return None


def find_inline_async(line: str) -> int | None:
    """If line contains inline 'async ... =>', return index of 'async'. Otherwise None."""
    idx = line.find('async')
    if idx != -1 and '=>' in line[idx:]:
        return idx
    return None


def process_file(filepath: Path, tag: str) -> bool:
    """Process one route file, injecting tags. Returns True if changed."""
    lines = filepath.read_text().splitlines()
    n = len(lines)
    result = []
    changed = False
    i = 0

    while i < n:
        line = lines[i]
        stripped = line.lstrip()
        match = ROUTE_START.match(line)

        if not match:
            result.append(line)
            i += 1
            continue

        # === This line starts a route ===
        indent = get_indent(line)

        # Find the end of this route block
        route_end = route_end_index(lines, i, n)
        if route_end is None:
            result.append(line)
            i += 1
            continue

        # Grab the full route block
        block = lines[i:route_end + 1]
        block_text = '\n'.join(block)

        # Already has tags → copy unchanged
        if 'tags:' in block_text:
            result.extend(block)
            i = route_end + 1
            continue

        # Check if block has inline async handler on the route call line
        inline_async = find_inline_async(line)

        if inline_async is not None:
            # === Pattern 3: inline arrow fn with no options ===
            # e.g. "  app.post('/hello', async (request) => {"
            # Restructure: split the route call to add schema as a separate argument
            before_async = line[:inline_async]  # "  app.post('/hello', "
            after_async = line[inline_async:]  # "async (request) => {"
            # before_async ends with ', ' → strip to just before that
            # Find the last comma before 'async'
            before_part = before_async.rstrip()
            # Remove trailing ', ' from the route call args
            if before_part.endswith(','):
                before_part = before_part[:-1].rstrip()
            result.append(before_part + ',')
            result.append(f'{indent}  schema: {{ tags: [\'{tag}\'] }},')
            result.append(indent + after_async)
            # Append the rest of the route block (body + '});')
            result.extend(lines[i + 1:route_end + 1])
            changed = True
            i = route_end + 1
            continue

        # === Multi-line route ===
        # Find 'opts_close' and 'async_line' within the route block boundaries
        opts_close = None
        for k in range(i + 1, route_end):
            if lines[k].rstrip().endswith('},'):
                opts_close = k
                break

        # async_line: first line starting with 'async' AFTER options close
        # (or at the same line if '}, async ...' is on one line)
        async_line = None
        search_start = (opts_close if opts_close is not None else i) + 1
        for k in range(search_start, route_end):
            if lines[k].lstrip().startswith('async'):
                async_line = k
                break

        # async_line is within [opts_close, route_end)
        # If async_line == opts_close, the '},' and 'async' are on the SAME line → Pattern 2B
        # If async_line > opts_close, they're on SEPARATE lines → Pattern 2A
        if opts_close is not None and async_line is not None:
            if async_line == opts_close:
                # === Pattern 2B: '}, async ...' on same line ===
                opts_close_line = lines[opts_close]
                after_comma = opts_close_line[opts_close_line.index('},') + 2:]
                opts_contents = lines[i:opts_close]
            else:
                # === Pattern 2A: options + separate async line ===
                after_comma = None
                opts_contents = lines[i:opts_close]

            if has_tags_in_options(opts_contents):
                result.extend(block)
                i = route_end + 1
                continue
            if has_schema_in_options(opts_contents):
                # Pattern 1: inject tags into existing schema
                for l in opts_contents:
                    stripped_l = l.lstrip()
                    if stripped_l.startswith('schema:'):
                        result.append(l)
                        result.append(f'{indent}  tags: [\'{tag}\'],')
                    else:
                        result.append(l)
                if after_comma is not None:
                    # Pattern 2B: replace '}, async ...' with '},' then async
                    result.append(f'{indent}}},')
                    result.append(indent + after_comma.lstrip())
                    result.extend(lines[opts_close + 1:route_end + 1])
                else:
                    # Pattern 2A: keep '},' and async line as-is
                    result.append(lines[opts_close])
                    result.extend(lines[opts_close + 1:route_end + 1])
                changed = True
                i = route_end + 1
                continue
            else:
                # No schema in options: insert schema block
                if after_comma is not None:
                    # Pattern 2B: '}, async ...' on same line
                    for l in opts_contents:
                        result.append(l)
                    result.append(f'{indent}  schema: {{ tags: [\'{tag}\'] }},')
                    result.append(f'{indent}}},')
                    result.append(indent + after_comma.lstrip())
                    result.extend(lines[opts_close + 1:route_end + 1])
                elif opts_contents:
                    # Pattern 2A: options object with separate async
                    for l in opts_contents:
                        result.append(l)
                    result.append(f'{indent}  schema: {{ tags: [\'{tag}\'] }},')
                    result.append(lines[opts_close])
                    result.extend(lines[opts_close + 1:route_end + 1])
                else:
                    # opts_contents is empty → inline async (Pattern 3)
                    # The route call line is the async line
                    # Insert schema before the route call line
                    pass  # handled by the earlier inline_async branch

            if 'schema:' in opts_text:
                # Pattern 1 variant: inject tags into existing schema
                inserted = False
                for k, l in enumerate(opts_block):
                    if 'schema:' in l and '{' in l:
                        result.append(l)
                        result.append(f'{indent}  tags: [\'{tag}\'],')
                        inserted = True
                    else:
                        result.append(l)
                result.append(f'{indent}}},')  # close options
                result.append(indent + after_comma.lstrip())  # async handler
                changed = True
                i = route_end + 1
                continue
            else:
                # Pattern 2B: insert schema then '},' then async
                for k, l in enumerate(opts_block):
                    result.append(l)
                result.append(f'{indent}  schema: {{ tags: [\'{tag}\'] }},')
                result.append(f'{indent}}},')  # close options
                result.append(indent + after_comma.lstrip())  # async handler
                result.extend(lines[opts_close + 1:route_end + 1])
                changed = True
                i = route_end + 1
        # Fallback: can't determine structure → copy unchanged
        result.extend(block)
        i = route_end + 1

    if changed:
        filepath.write_text('\n'.join(result) + '\n')
    return changed


if __name__ == '__main__':
    base = Path('/Users/tiejunsun/github/evo')
    total = 0
    for rel_path, tag in TAG_MAP.items():
        fpath = base / rel_path
        if not fpath.exists():
            print(f'WARNING: {fpath} does not exist')
            continue
        try:
            changed = process_file(fpath, tag)
            print(f"{'CHANGED' if changed else 'no change'}: {rel_path} -> {tag}")
            if changed:
                total += 1
        except Exception as e:
            print(f'ERROR {rel_path}: {e}')
            import traceback
            traceback.print_exc()
            sys.exit(1)
    print(f'\nDone. Changed {total} files.')
