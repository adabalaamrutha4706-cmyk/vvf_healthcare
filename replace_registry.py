import os

def replace_in_file(file_path):
    print(f"Processing {file_path}...")
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace npmmirror registry with npmjs
    updated = content.replace("https://registry.npmmirror.com", "https://registry.npmjs.org")
    
    if updated != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(updated)
        print(f"Successfully updated {file_path}")
    else:
        print(f"No changes needed for {file_path}")

if __name__ == "__main__":
    replace_in_file("backend/package-lock.json")
    replace_in_file("frontend/package-lock.json")
