import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

groq_key = os.getenv("GROQ_API_KEY")
client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
model_name = "llama-3.3-70b-versatile" # Let's use the larger one just in case

text = "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. Constructed from 1887 to 1889 as the entrance to the 1889 World's Fair, it was initially criticized by some of France's leading artists and intellectuals for its design, but it has become a global cultural icon of France and one of the most recognizable structures in the world."

prompt = f"""
Generate 5 high-quality Multiple Choice Questions (MCQs) based on this text.
DIFFICULTY LEVEL: medium (Beginner = basic facts, Expert = deep inference and application)

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
    print("RESPONSE CONTENT:")
    print(response.choices[0].message.content)
    data = json.loads(response.choices[0].message.content)
    print("\nPARSED MCQS:")
    mcqs = data if isinstance(data, list) else data.get("mcqs", data)
    print(json.dumps(mcqs, indent=2))
except Exception as e:
    print(f"Error: {e}")
