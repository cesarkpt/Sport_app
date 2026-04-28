import sys

def find_first_error(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    
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
                start_index = i
            elif char == quote_char:
                in_string = False
        
        if not in_string:
            if char == '{': pass # check nesting...
            
    if in_string:
        line = text[:start_index].count('\n') + 1
        print(f"Unclosed {quote_char} starting at index {start_index}, line {line}")
        print("Context:", text[start_index:start_index+100])

if __name__ == '__main__':
    find_first_error(sys.argv[1])
