import sys

def check_syntax(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    stack = []
    pairs = {'{': '}', '[': ']', '(': ')'}
    rev_pairs = {v: k for k, v in pairs.items()}
    in_string = False
    quote_char = ''
    escaped = False
    
    for i, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        
        if char == '\\':
            escaped = True
            continue
            
        if char in ["'", '"', '`']:
            if not in_string:
                in_string = True
                quote_char = char
            elif char == quote_char:
                in_string = False
            continue
            
        if in_string:
            continue
            
        if char in pairs:
            stack.append((char, i))
        elif char in rev_pairs:
            if not stack:
                print(f"Extra closing {char} at index {i}")
            elif stack[-1][0] != rev_pairs[char]:
                print(f"Mismatched {char} at index {i}, expected {pairs[stack[-1][0]]} for {stack[-1][0]} at index {stack[-1][1]}")
            else:
                stack.pop()
                
    if in_string:
        print(f"Unclosed string starting with {quote_char}")
    if stack:
        for char, i in stack:
            print(f"Unclosed {char} at index {i}")

if __name__ == '__main__':
    check_syntax(sys.argv[1])
