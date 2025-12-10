#!/usr/bin/env python3
"""
OITH Markdown to PDF Converter
Converts all .md files to .pdf with professional styling
"""

import os
import markdown
from xhtml2pdf import pisa
from pathlib import Path
from io import BytesIO

# Professional CSS styling for PDFs
PDF_STYLE = """
<style>
@page {
    size: letter;
    margin: 0.75in;
    @frame footer {
        -pdf-frame-content: footerContent;
        bottom: 0.5in;
        margin-left: 0.75in;
        margin-right: 0.75in;
        height: 0.5in;
    }
}

body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #333;
}

h1 {
    color: #1a1a2e;
    border-bottom: 2px solid #e94560;
    padding-bottom: 8px;
    margin-top: 0;
    font-size: 20pt;
}

h2 {
    color: #16213e;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin-top: 20px;
    font-size: 14pt;
}

h3 {
    color: #0f3460;
    margin-top: 15px;
    font-size: 12pt;
}

h4 {
    color: #333;
    margin-top: 12px;
    font-size: 11pt;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 9pt;
}

th, td {
    border: 1px solid #ccc;
    padding: 6px 10px;
    text-align: left;
}

th {
    background-color: #1a1a2e;
    color: white;
    font-weight: bold;
}

tr:nth-child(even) {
    background-color: #f5f5f5;
}

code {
    background-color: #f0f0f0;
    padding: 1px 4px;
    font-family: Courier, monospace;
    font-size: 9pt;
}

pre {
    background-color: #2d2d2d;
    color: #f8f8f2;
    padding: 12px;
    font-size: 8pt;
    white-space: pre-wrap;
    word-wrap: break-word;
}

blockquote {
    border-left: 3px solid #e94560;
    margin: 12px 0;
    padding: 8px 15px;
    background-color: #f9f9f9;
    font-style: italic;
}

ul, ol {
    margin: 8px 0;
    padding-left: 20px;
}

li {
    margin: 4px 0;
}

a {
    color: #e94560;
}

hr {
    border: none;
    border-top: 1px solid #ddd;
    margin: 20px 0;
}

.footer {
    font-size: 8pt;
    color: #666;
    text-align: center;
}

.header-info {
    background-color: #1a1a2e;
    color: white;
    padding: 10px 15px;
    margin: -15px -15px 20px -15px;
    font-size: 8pt;
}

.checkmark {
    color: #10b981;
}

.pending {
    color: #f59e0b;
}
</style>
"""

def convert_md_to_pdf(md_path, pdf_path):
    """Convert a single markdown file to PDF"""
    try:
        # Read markdown content
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        # Convert markdown to HTML with extensions
        html_content = markdown.markdown(
            md_content,
            extensions=[
                'tables',
                'fenced_code',
                'toc',
                'sane_lists',
                'nl2br'
            ]
        )
        
        # Replace checkbox markers with symbols
        html_content = html_content.replace('[ ]', '☐')
        html_content = html_content.replace('[x]', '✓')
        html_content = html_content.replace('[X]', '✓')
        
        # Replace emoji-like markers
        html_content = html_content.replace('⬜', '☐')
        html_content = html_content.replace('✅', '✓')
        html_content = html_content.replace('🟡', '○')
        
        # Get filename for header
        filename = Path(md_path).stem
        
        # Wrap in full HTML document
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            {PDF_STYLE}
        </head>
        <body>
            <div class="header-info">
                <strong>OITH</strong> | {filename} | Confidential
            </div>
            {html_content}
            <div id="footerContent" class="footer">
                OITH Confidential - <pdf:pagenumber>
            </div>
        </body>
        </html>
        """
        
        # Create PDF directory if needed
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
        
        # Convert to PDF using xhtml2pdf
        with open(pdf_path, "wb") as pdf_file:
            pisa_status = pisa.CreatePDF(
                full_html,
                dest=pdf_file,
                encoding='utf-8'
            )
        
        return not pisa_status.err
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    # Get project root
    project_root = Path.cwd()
    
    # Find all markdown files
    md_files = list(project_root.rglob("*.md"))
    
    # Exclude common directories
    exclude_dirs = ['node_modules', '.git', 'venv', '__pycache__', 'pdf_documents']
    md_files = [f for f in md_files if not any(ex in str(f) for ex in exclude_dirs)]
    
    print(f"\n{'='*60}")
    print(f"  OITH Markdown to PDF Converter")
    print(f"{'='*60}")
    print(f"\n📄 Found {len(md_files)} markdown files to convert\n")
    
    success_count = 0
    failed_count = 0
    
    for md_file in md_files:
        # Create corresponding PDF path
        relative_path = md_file.relative_to(project_root)
        pdf_path = project_root / "pdf_documents" / relative_path.with_suffix('.pdf')
        
        print(f"📝 Converting: {relative_path}")
        
        if convert_md_to_pdf(str(md_file), str(pdf_path)):
            print(f"   ✅ Created: pdf_documents/{relative_path.with_suffix('.pdf')}")
            success_count += 1
        else:
            print(f"   ❌ Failed")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"  Conversion Complete!")
    print(f"  ✅ Success: {success_count}")
    print(f"  ❌ Failed: {failed_count}")
    print(f"{'='*60}\n")
    
    print(f"📁 All PDFs saved to: pdf_documents/")

if __name__ == "__main__":
    main()
