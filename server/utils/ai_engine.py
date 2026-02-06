import os
import json
from openai import OpenAI

# Initialize client (Groq or OpenAI)
groq_key = os.getenv("GROQ_API_KEY")
openai_key = os.getenv("OPEN_AI_API_KEY")

if groq_key:
    api_key = groq_key
    base_url = "https://api.groq.com/openai/v1"
    model_name = "llama-3.1-8b-instant" # Modern, fast
elif openai_key:
    api_key = openai_key
    base_url = "https://api.openai.com/v1"
    model_name = "gpt-3.5-turbo"
else:
    api_key = "simulated_key"
    base_url = None
    model_name = "simulated"

client = OpenAI(api_key=api_key, base_url=base_url) if api_key != "simulated_key" else None

from server.utils.intelligence import calculate_exam_weights, get_importance_badge

def generate_exam_summary(text, length=50, exam_mode=True, explain_simply=False, language="English"):
    """
    Generates an intelligence-augmented summary with dependency mapping and scheduling.
    """
    weights = calculate_exam_weights(text)
    
    if api_key == "simulated_key":
        # Simplified simulation for Phase 4 fields
        return {
            "topic": "Advanced Material",
            "language": language,
            "concepts": [
                {"title": "Core Foundations", "content": "Detailed deep-dive into basic principles...", "importance": "HOT"},
                {"title": "Advanced Applications", "content": "Complex implementations of the core logic...", "importance": "WARM"}
            ],
            "dependencies": [["Core Foundations", "Advanced Applications"]],
            "studySchedule": [
                {"day": 1, "task": "Master Core Foundations", "goal": "90% retention"},
                {"day": 2, "task": "Explore Advanced Applications", "goal": "Hands-on implementation"},
                {"day": 3, "task": "Final Review & Quiz", "goal": "Exam readiness"}
            ],
            "definitions": {"Concept A": "Definition A"},
            "formulas": ["Logic Gate X -> Y"],
            "tips": ["Focus on the first principles first."],
            "mnemonics": [],
            "examFocus": []
        }

    simplify_prompt = "Explain like I'm five. Use extremely simple analogies and avoid jargon." if explain_simply else "Maintain academic precision but optimize for exam recall."
    
    prompt = f"""
    Act as a professional study assistant. 
    RESPONSE LANGUAGE: {language}
    PEDAGOGY STRATEGY: {simplify_prompt}
    
    Structure the output as JSON with:
    - topic: Main subject
    - language: {language}
    - concepts: List of 3-5 objects with 'title' and 'content' (10-15 lines per concept).
    - dependencies: List of pairs [A, B] indicating Concept A should be learned before Concept B.
    - studySchedule: List of 3 objects with 'day' (number), 'task' (specific action), and 'goal'.
    - definitions: Dictionary of terms
    - formulas: List of core principles/formulas
    - tips: 3-5 high-value tips
    - mnemonics: Memory aids
    - examFocus: Weighted focus areas
    
    {text}
    """
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": f"You are a professional study assistant. Always respond in valid JSON. Language: {language}"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"AI Summary Error: {e}")
        return None

def rephrase_text(text, style="Academic"):
    """
    Paraphrases text to be plagiarism-safe and style-specific.
    """
    if api_key == "simulated_key":
        return f"[Rephrased in {style} style]: {text[:100]}..."

    prompt = f"Paraphrase the following text in a '{style}' style. Ensure it is plagiarism-safe but retains all technical accuracy and core meaning.\n\n{text}"
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are an expert academic editor."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Rephrase Error: {e}"

def generate_study_questions(text, difficulty="medium"):
    """Generates MCQs and study questions with adaptive difficulty."""
    if api_key == "simulated_key":
        return [
            {"question": f"Sample {difficulty.capitalize()} Question?", "options": ["A", "B", "C", "D"], "correct": 0}
        ]

    prompt = f"""
    Generate 5 high-quality Multiple Choice Questions (MCQs) based on this text.
    DIFFICULTY LEVEL: {difficulty} (Beginner = basic facts, Expert = deep inference and application)
    
    Return as JSON: {{"mcqs": [{{"question": "", "options": ["", "", "", ""], "correct": index}}]}}
    
    CONTENT:
    {text}
    """

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a professional study assistant. Always respond in valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        raw_content = response.choices[0].message.content
        print(f"RAW MCQ CONTENT: {raw_content[:500]}...") 
        data = json.loads(raw_content)
        
        # Robust retrieval of the questions list
        mcqs = []
        if isinstance(data, list):
            mcqs = data
        elif isinstance(data, dict):
            if "mcqs" in data:
                mcqs = data["mcqs"]
            elif "questions" in data:
                mcqs = data["questions"]
            else:
                # Try to find any list in the dict
                for val in data.values():
                    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict) and "question" in val[0]:
                        mcqs = val
                        break
        
        print(f"Final MCQs count: {len(mcqs)}")
        return mcqs if mcqs else [{"question": "AI failed to generate specific questions. Review your notes directly.", "options": ["Understood", "Try again", "N/A", "N/A"], "correct": 0}]
    except Exception as e:
        print(f"AI MCQ Error: {e}")
        # Final fallback - Simulation style but better than nothing
        return [{"question": f"Key Topic: {text[:50]}...?", "options": ["Found in text", "Not in text", "Partially", "None"], "correct": 0}]
