#!/bin/bash
#
# Quick test: Verify the hook works with one innocuous command
#

HOOK_SCRIPT=".claude/hooks/prevent-force-push.py"

echo "🧪 Quick Hook Test"
echo "===================="
echo ""
echo "Testing with an innocuous command: 'echo hello world'"
echo ""

# Simulate what Claude Code sends to the hook
TEST_INPUT='{"tool_name": "Bash", "tool_input": {"command": "echo hello world"}, "tool_use_id": "quick_test"}'

# Run the hook
echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ SUCCESS: Hook allowed the innocuous command (exit code 0)"
    echo ""
    echo "The hook is working correctly!"
    echo "Safe commands pass through, dangerous ones will be blocked."
else
    echo "❌ FAILED: Hook blocked an innocuous command (exit code $EXIT_CODE)"
    echo ""
    echo "Something is wrong with the hook configuration."
fi
echo ""
echo "To test blocking, run: .claude/hooks/test-prevent-force-push.sh"
