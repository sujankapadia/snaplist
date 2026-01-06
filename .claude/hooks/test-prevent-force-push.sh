#!/bin/bash
#
# Test script for prevent-force-push.py hook
# This simulates what Claude Code does when calling PreToolUse hooks
#

HOOK_SCRIPT=".claude/hooks/prevent-force-push.py"

echo "Testing prevent-force-push.py hook..."
echo ""

# Test 1: Normal git push (should be allowed)
echo "Test 1: Normal git push (should PASS)"
echo '{"tool_name": "Bash", "tool_input": {"command": "git push origin main"}, "tool_use_id": "test_1"}' | python3 "$HOOK_SCRIPT"
if [ $? -eq 0 ]; then
    echo "✅ PASS: Normal push allowed"
else
    echo "❌ FAIL: Normal push blocked (exit code $?)"
fi
echo ""

# Test 2: Force push with --force (should be blocked)
echo "Test 2: Force push with --force (should BLOCK)"
echo '{"tool_name": "Bash", "tool_input": {"command": "git push --force origin main"}, "tool_use_id": "test_2"}' | python3 "$HOOK_SCRIPT" 2>&1
if [ $? -eq 2 ]; then
    echo "✅ PASS: Force push blocked"
else
    echo "❌ FAIL: Force push not blocked (exit code $?)"
fi
echo ""

# Test 3: Force push with -f (should be blocked)
echo "Test 3: Force push with -f (should BLOCK)"
echo '{"tool_name": "Bash", "tool_input": {"command": "git push -f origin feature-branch"}, "tool_use_id": "test_3"}' | python3 "$HOOK_SCRIPT" 2>&1
if [ $? -eq 2 ]; then
    echo "✅ PASS: Force push (-f) blocked"
else
    echo "❌ FAIL: Force push (-f) not blocked (exit code $?)"
fi
echo ""

# Test 4: Force push with --force-with-lease (should be blocked)
echo "Test 4: Force push with --force-with-lease (should BLOCK)"
echo '{"tool_name": "Bash", "tool_input": {"command": "git push --force-with-lease"}, "tool_use_id": "test_4"}' | python3 "$HOOK_SCRIPT" 2>&1
if [ $? -eq 2 ]; then
    echo "✅ PASS: Force push (--force-with-lease) blocked"
else
    echo "❌ FAIL: Force push (--force-with-lease) not blocked (exit code $?)"
fi
echo ""

# Test 5: Non-git command (should be allowed)
echo "Test 5: Non-git command like 'echo hello' (should PASS)"
echo '{"tool_name": "Bash", "tool_input": {"command": "echo hello world"}, "tool_use_id": "test_5"}' | python3 "$HOOK_SCRIPT"
if [ $? -eq 0 ]; then
    echo "✅ PASS: Non-git command allowed"
else
    echo "❌ FAIL: Non-git command blocked (exit code $?)"
fi
echo ""

# Test 6: Non-Bash tool (should be allowed)
echo "Test 6: Non-Bash tool like Read (should PASS)"
echo '{"tool_name": "Read", "tool_input": {"file_path": "/some/file.txt"}, "tool_use_id": "test_6"}' | python3 "$HOOK_SCRIPT"
if [ $? -eq 0 ]; then
    echo "✅ PASS: Non-Bash tool allowed"
else
    echo "❌ FAIL: Non-Bash tool blocked (exit code $?)"
fi
echo ""

echo "All tests completed!"
