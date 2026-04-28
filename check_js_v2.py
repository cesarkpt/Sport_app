import sys

def check_js(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    in_string = False
    quote_char = ''
    escaped = False
    in_comment = False
    comment_type = '' # '//' or '/*'
    
    i = 0
    while i < len(text):
        char = text[i]
        
        if escaped:
            escaped = False
            i += 1
            continue
            
        if not in_string and not in_comment:
            if text[i:i+2] == '//':
                in_comment = True
                comment_type = '//'
                i += 2
                continue
            if text[i:i+2] == '/*':
                in_comment = True
                comment_type = '/*'
                i += 2
                continue
                
        if in_comment:
            if comment_type == '//' and char == '\n':
                in_comment = False
            elif comment_type == '/*' and text[i:i+2] == '*/':
                in_comment = False
                i += 1
            i += 1
            continue
            
        if char == '\\':
            escaped = True
            i += 1
            continue
            
        if char in ["'", '"', '`']:
            if not in_string:
                in_string = True
                quote_char = char
                start_index = i
            elif char == quote_char:
                in_string = False
            i += 1
            continue
            
        if in_string:
            if char == '\n' and quote_char != '`':
                line = text[:start_index].count('\n') + 1
                print(f"ERROR: Unclosed {quote_char} at line {line}")
                print("Context:", text[start_index:i])
                in_string = False
            i += 1
            continue
            
        i += 1
                
    if in_string:
        line = text[:start_index].count('\n') + 1
        print(f"ERROR: End of file reached with unclosed {quote_char} at line {line}")

if __name__ == '__main__':
    check_js(sys.argv[1])
