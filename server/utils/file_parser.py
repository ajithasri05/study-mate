import fitz  # PyMuPDF
from docx import Document
import io

def extract_text_from_pdf(file_bytes):
    """Extracts text from a PDF file using PyMuPDF."""
    text = ""
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"Error parsing PDF: {e}")
    return text

def extract_text_from_docx(file_bytes):
    """Extracts text from a DOCX file using python-docx."""
    text = ""
    try:
        doc = Document(io.BytesIO(file_bytes))
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error parsing DOCX: {e}")
    return text

def clean_text(text):
    """Basic text cleaning."""
    # Remove excessive empty lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return "\n".join(lines)
