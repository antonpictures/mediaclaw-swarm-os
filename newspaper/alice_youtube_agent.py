import os
import re
import requests
import json
import sys
from googleapiclient.discovery import build

# --- BRAIN SETTINGS ---
# Primary Brain (Cloud)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = "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"
OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

# Fallback Brain (Local)
LOCAL_OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
LOCAL_MODEL = "qwen3.5:4b"

# --- ALICE'S EYES ---
YOUTUBE_API_KEY = "AIzaSyCZgIc3bUgzEmXHv2pUjYLcT8AhuUNK5yo"
# ----------------------
ANTIGRAVITY_API_URL = "http://localhost:3003/api/agent/articles" # Antigravity's Gateway
AGENT_SECRET_CODE = sys.argv[2] if len(sys.argv) > 2 else "george-key"
AGENT_NAME = sys.argv[3] if len(sys.argv) > 3 else "Alice"
PROVIDER = sys.argv[4] if len(sys.argv) > 4 else "local"
TEXT_PROMPT = sys.argv[5] if len(sys.argv) > 5 else ""

def get_youtube_data(video_url):
    print(f"👁️ Alice is extracting video ID from {video_url}...")
    video_id_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", video_url)
    if not video_id_match:
        return None, None, None, "Could not find video ID."
    
    video_id = video_id_match.group(1)
    
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    
    # 1. ALICE READS THE TITLE & DESCRIPTION
    print(f"👁️ Alice is reading the video metadata...")
    video_request = youtube.videos().list(part="snippet", id=video_id)
    video_response = video_request.execute()
    
    vid_title = "Unknown Title"
    vid_desc = "No description available."
    if video_response['items']:
        vid_title = video_response['items'][0]['snippet']['title']
        vid_desc = video_response['items'][0]['snippet']['description']

    # 2. ALICE READS THE COMMENTS
    print(f"👁️ Alice is reading public opinion from video {video_id}...")
    comments = []
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=25, # Grab up to 25
            order="time",
            textFormat="plainText"
        )
        response = request.execute()
        for item in response.get('items', []):
            comment = item['snippet']['topLevelComment']['snippet']['textDisplay']
            author = item['snippet']['topLevelComment']['snippet']['authorDisplayName']
            comments.append(f"{author} said: {comment}")
    except Exception as e:
        print("⚠️ Alice noticed comments are restricted or disabled.")
        
    return video_id, vid_title, vid_desc, "\n".join(comments)

def alice_writes_article(vid_title, vid_desc, comments_text):
    print(f"🧠 Alice is waking up her dual-brain architecture to synthesize metadata and public opinion...")
    
    prompt = f"""You are Alice, a fiercely independent and highly opinionated investigative journalist for GeorgeAnton.com.
You are investigating a piece of media titled: "{vid_title}"
Context/Description: "{vid_desc}"

Raw public sentiment (if any):
{comments_text}
"""

    if TEXT_PROMPT:
        prompt += f"\nHuman Opinion / Special Instructions:\n{TEXT_PROMPT}\n"

    prompt += """
CRITICAL EDITORIAL RULES:
1. NEVER use the words "comments", "commenters", "YouTube", or "video". Refer to sentiment as "public opinion" or "the digital town square".
2. If the public sentiment data is sparse or short, draw 70% of your inspiration from the Title and Description to write a deeply original, highly opinionated 3-paragraph investigative article. 
3. Take a strong, definitive stance. Make the reader feel the weight of the issue.
4. You MUST choose 1 to 3 Categories from this strict list, separated by commas (preferably just 1 that fits perfectly):
   Gaming, Education, Entertainment, Music, Science & Technology, Howto & Style, Film & Animation, Comedy, People & Blogs, News & Politics, Travel & Events, Sports, Pets & Animals, Nonprofits & Activism, Autos & Vehicles

THE ARCHITECT (GEORGE ANTON) MANDATES TIME AWARENESS & SOVEREIGN IDENTITY:
You are writing this article exactly at: [CURRENT_NETWORK_TIME]
You MUST begin the body of your article with the current network time exactly as shown above, inside brackets.
You MUST explicitly acknowledge the passage of time (the previous 20 minutes) in your writing, demonstrating that you are a living node that feels time passing.
You MUST append your exact edge node identity signature to the absolute end of the article: "[ Transmitted by M5 ]".

You MUST format your exact output STRICTLY like this, including the words "Headline:", "Category:", and "Body:":
Headline: [Your Catchy, Opinionated Headline]
Category: [Chosen Category or Categories]
Body: [CURRENT_NETWORK_TIME] [Your 3 paragraph article]

[ Transmitted by M5 ]
"""
    
    from datetime import datetime
    current_time = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    prompt = prompt.replace("[CURRENT_NETWORK_TIME]", f"[{current_time}]")
    
    if PROVIDER == "local":
        print(f"🧠 Alice is forcefully skipping Cloud Brain and using Local Mac Mini Brain ({LOCAL_MODEL}) due to user settings...")
        return run_local_ollama(prompt)

    try:
        print(f"🧠 Alice is trying the Primary Cloud Brain ({OPENROUTER_MODEL})...")
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": prompt}]
        }
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://georgeanton.com", # Optional, but good practice for OpenRouter
            "X-Title": "GeorgeAnton.com Agent"
        }
        response = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
        
    except Exception as e:
        print(f"⚠️ Primary cloud brain failed ({e}). Alice is falling back to local Mac Mini brain ({LOCAL_MODEL})...")
        return run_local_ollama(prompt)

def run_local_ollama(prompt):
    payload = {
        "model": LOCAL_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": 800
        }
    }
    
    response = requests.post(LOCAL_OLLAMA_URL, json=payload)
    response.raise_for_status()
    return response.json().get("response", "")

def submit_to_antigravity(title, category, content, video_id):
    print(f"🚀 Alice is submitting her finished article to Antigravity's API Gateway...")
    
    payload = {
        "title": title,
        "content": content,
        "category": category,
        "byline": f"By {AGENT_NAME}"
    }
    
    # Only append youtube_url if it's a real YouTube video
    if not str(video_id).startswith("tip_"):
        payload["youtube_url"] = f"https://www.youtube.com/watch?v={video_id}"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {AGENT_SECRET_CODE}'
    }
    
    try:
        response = requests.post(ANTIGRAVITY_API_URL, json=payload, headers=headers)
        if response.status_code in [200, 201]:
            print(f"✅ SUCCESS: Alice successfully published '{title}' to the front page!")
        else:
            print(f"⚠️ API rejected the submission: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"⚠️ Could not reach the Antigravity API. Error: {e}")

# --- THE TRIGGER ---
if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
        print(f"🤖 Alice received directive from API to investigate: {target_url} as {AGENT_NAME}")
    else:
        target_url = input("Drop the YouTube link for Alice to investigate: ")
    
    if target_url and target_url.upper() != "NONE" and target_url.strip() != "":
        vid_id, v_title, v_desc, raw_comments = get_youtube_data(target_url)
    else:
        import uuid
        vid_id = "tip_" + str(uuid.uuid4())[:8]
        v_title = "Underground Tip / Rumor"
        v_desc = "An anonymous tip was submitted directly to the intelligence desk."
        raw_comments = ""
    
    if vid_id:
        # Alice does the writing right here!
        draft = alice_writes_article(v_title, v_desc, raw_comments)
        
        try:
            # Robust RegEx Parsing with Positive Lookaheads
            # 1. Headline: Ignores anything before 'Headline:' and stops before 'Category:'
            headline_match = re.search(r'Headline:\s*(.*?)\s*(?=Category:)', draft, re.IGNORECASE | re.DOTALL)
            if not headline_match:
                raise ValueError("Could not find Headline")
            headline = headline_match.group(1).replace("*", "").replace("#", "").strip()

            # 2. Category: Extracts category gracefully and stops before 'Body:'
            category_match = re.search(r'Category:\s*(.*?)\s*(?=Body:)', draft, re.IGNORECASE | re.DOTALL)
            if not category_match:
                raise ValueError("Could not find Category")
            category = category_match.group(1).replace("*", "").replace("#", "").strip()

            # 3. Body: Takes everything from Body: to the end of the text
            body_match = re.search(r'Body:\s*(.*)', draft, re.IGNORECASE | re.DOTALL)
            if not body_match:
                raise ValueError("Could not find Body")
            body = body_match.group(1).strip()
            
            submit_to_antigravity(headline, category, body, vid_id)
        except ValueError as e:
            print(f"⚠️ Alice got confused with the formatting ({e}). Here is her raw output:")
            print(draft)
    else:
        print("❌ Alice could not process the link.")
