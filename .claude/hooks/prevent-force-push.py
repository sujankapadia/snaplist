#!/usr/bin/env python3
"""
PreToolUse hook to prevent dangerous git force push operations.

This hook blocks:
- git push --force
- git push -f
- git push --force-with-lease

Exit codes:
- 0: Allow the command to proceed
- 2: Block the command and show error message to Claude
"""

import json
import sys
import re

def main():
    # Read the PreToolUse input from stdin
    input_data = json.load(sys.stdin)

    # DEBUG: Log what we received
    print(f"DEBUG: Hook called!", file=sys.stderr)
    print(f"DEBUG: Input data: {input_data}", file=sys.stderr)

    # Extract tool information
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # DEBUG: Log the command we're checking
    print(f"DEBUG: Tool name: {tool_name}", file=sys.stderr)
    print(f"DEBUG: Command: {command}", file=sys.stderr)

    # Only check Bash tool commands
    if tool_name != "Bash":
        print(f"DEBUG: Not a Bash command, allowing", file=sys.stderr)
        sys.exit(0)

    # Check for force push patterns
    # Match: git push --force, git push -f, git push --force-with-lease
    force_push_patterns = [
        r'\bgit\s+push\s+.*--force\b',
        r'\bgit\s+push\s+.*-f\b',
        r'\bgit\s+push\s+.*--force-with-lease\b'
    ]

    print(f"DEBUG: Checking patterns...", file=sys.stderr)
    for pattern in force_push_patterns:
        print(f"DEBUG: Testing pattern: {pattern}", file=sys.stderr)
        if re.search(pattern, command):
            print(f"DEBUG: MATCH! Blocking command", file=sys.stderr)
            # Block the command with exit code 2
            print("❌ Force push is not permitted!", file=sys.stderr)
            print("", file=sys.stderr)
            print("Force pushing can overwrite history and cause data loss.", file=sys.stderr)
            print("", file=sys.stderr)
            print("If you really need to force push, please:", file=sys.stderr)
            print("1. Verify you're not on main/master branch", file=sys.stderr)
            print("2. Confirm no one else is working on this branch", file=sys.stderr)
            print("3. Use the terminal directly (not through Claude)", file=sys.stderr)
            sys.exit(2)

    # Allow the command
    print(f"DEBUG: No match found, allowing command", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()
