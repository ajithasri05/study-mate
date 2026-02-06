import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

groq_key = os.getenv("GROQ_API_KEY")
client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

try:
    response = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": "You are a helpful assistant. Respond in JSON."},
            {"role": "user", "content": "Say hello in JSON format with a key 'message'."}
        ],
        response_format={"type": "json_object"}
    )
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
