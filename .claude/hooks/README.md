# Claude Code Hooks

This directory contains PreToolUse hooks for protecting against dangerous git operations.

## Installed Hooks

### `prevent-force-push.py`

Blocks force push commands to prevent accidental history overwrites.

**Blocks these commands:**

- `git push --force`
- `git push -f`
- `git push --force-with-lease`

**Allows:**

- Normal `git push`
- All other git commands
- All non-git commands

## Setup Instructions

### Option 1: Global Configuration (All Projects)

Add to your global Claude Code settings:

1. Open Claude Code settings (Cmd+, or Ctrl+,)
2. Search for "hooks"
3. Add the following JSON configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/prevent-force-push.py"
          }
        ]
      }
    ]
  }
}
```

4. Copy the hook to your global hooks directory:
   ```bash
   mkdir -p ~/.claude/hooks
   cp .claude/hooks/prevent-force-push.py ~/.claude/hooks/
   chmod +x ~/.claude/hooks/prevent-force-push.py
   ```

### Option 2: Project-Specific Configuration

Add to your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/prevent-force-push.py"
          }
        ]
      }
    ]
  }
}
```

## Testing

Run the test script to verify the hook works:

```bash
.claude/hooks/test-prevent-force-push.sh
```

Expected output: All tests should pass (6/6)

## How It Works

1. **PreToolUse Hook**: Executes before Claude runs a Bash command
2. **Input**: Receives JSON with `tool_name`, `tool_input`, and `tool_use_id`
3. **Decision**:
   - Exit code `0` = Allow command
   - Exit code `2` = Block command and show error to Claude
4. **Pattern Matching**: Uses regex to detect force push variants

## Example Blocked Command

When Claude tries to run:

```bash
git push --force origin main
```

The hook intercepts and blocks it, showing:

```
❌ Force push is not permitted!

Force pushing can overwrite history and cause data loss.

If you really need to force push, please:
1. Verify you're not on main/master branch
2. Confirm no one else is working on this branch
3. Use the terminal directly (not through Claude)
```

## Manual Override

If you genuinely need to force push, run the command directly in your terminal (not through Claude).

## Further Reading

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks.md)
- [PreToolUse Hook Reference](https://code.claude.com/docs/en/hooks.md#pretooluse)
