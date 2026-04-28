import sys

def check_js(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    in_string = False
    quote_char = ''
    escaped = False
    start_index = 0
    
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
                start_index = i
            elif char == quote_char:
                in_string = False
        
        # If we are in a string and hit a newline, and it's not a backtick string, it's an error in most JS environments (except template literals)
        if in_string and char == '\n' and quote_char != '`':
            line = text[:start_index].count('\n') + 1
            print(f"Unclosed {quote_char} at line {line}")
            print("Context:", text[start_index:i])
            in_string = False # Reset to find more errors

if __name__ == '__main__':
    check_js(sys.argv[1])
