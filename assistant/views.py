import os
import json
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST
import google.generativeai as genai

def index(request):
    return render(request, 'assistant/index.html')

def service_worker(request):
    """Serve sw.js from the root scope so it can control the entire site."""
    sw_path = os.path.join(os.path.dirname(__file__), 'static', 'sw.js')
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return HttpResponse(content, content_type='application/javascript')

@require_POST
def chat_api(request):
    try:
        data = json.loads(request.body)
        user_prompt = data.get('prompt', '').strip()

        if not user_prompt:
            return JsonResponse({'error': 'Prompt cannot be empty.'}, status=400)

        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return JsonResponse({'error': 'Gemini API key is not configured.'}, status=500)

        genai.configure(api_key=api_key)
        
        # Choose model specified in .env or fallback
        model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction="You are a helpful and concise classroom AI assistant. Explain topics simply and clearly using markdown formatting where appropriate."
        )

        response = model.generate_content(user_prompt)
        reply = response.text if response.text else "Sorry, I could not generate a response."

        return JsonResponse({'reply': reply})

    except Exception as e:
        return JsonResponse({'error': f'AI Service Error: {str(e)}'}, status=500)