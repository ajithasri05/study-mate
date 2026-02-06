import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

groq_key = os.getenv("GROQ_API_KEY")
client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

try:
    models = client.models.list()
    for model in models:
        print(model.id)
except Exception as e:
    print(f"Error: {e}")
