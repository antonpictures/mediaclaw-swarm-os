import os
import sys
import json
import requests
from google import genai
from google.genai import types
from googleapiclient.discovery import build

# Configuration
API_URL = "http://localhost:3001/api/articles"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    sys.exit(1)

if not YOUTUBE_API_KEY:
    print("Warning: YOUTUBE_API_KEY environment variable not set. Scraping will fail.")

client = genai.Client(api_key=GEMINI_API_KEY)
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

def fetch_youtube_comments(video_id, max_results=50):
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=max_results,
            order="relevance"
        )
        response = request.execute()
        comments = []
        for item in response['items']:
            comment = item['snippet']['topLevelComment']['snippet']['textDisplay']
            comments.append(comment)
        return comments
    except Exception as e:
        print(f"Failed to fetch YouTube comments: {e}")
        return []

def get_video_id(url):
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    return url

def analyze_comments(comments):
    if not comments:
        return "No public sentiment datastreams available."
    return "\n\n".join([f"- {c}" for c in comments])

def generate_article(youtube_url):
    print(f"Fetching video datastreams: {youtube_url}...")
    video_id = get_video_id(youtube_url)
    raw_comments = fetch_youtube_comments(video_id)
    comment_data = analyze_comments(raw_comments)

    prompt = f"""
    You are a world-class investigative journalist for "GeorgeAnton.com".
    Research the public sentiment of the following YouTube video by analyzing ONLY its top comments:
    VIDEO: {youtube_url}
    
    RAW COMMENT DATASTREAM (IGNORE ACTUAL TRANSCRIPT, FOCUS ONLY ON THESE USER COMMENTS):
    {comment_data}
    
    CORE RULES:
    1. HEADLINE: Bold, punchy, and intriguing.
    2. BYLINE: "By [Agent Name]" (e.g., By Coffeezilla Investigator).
    3. CONTENT: 
       - Minimum 6 paragraphs.
       - Use sophisticated vocabulary and industry jargon (agentic workflows, forensic analysis, cryptographic verification).
       - Include the YouTube embed ONLY ONCE, placed specifically after the second paragraph. 
         Format: [EMBED YOUTUBE: {youtube_url}]
       - Include a "📢 SPONSORED MESSAGE" block in the middle of the article. 
         Format: --- 📢 SPONSORED MESSAGE: [Creative ad text for the YouTube channel @imperialglobalmusic] ---
    4. ABOUT THE AUTHOR / OWNER: Every article must end with a brief bio of the journalist and their mission within the GeorgeAnton.com network.
    
    TONE: Forensic, disorienting, high-frequency, authoritative.
    """
    
    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
        )
    )
    
    return response.text

def post_to_syndicate(article_text, youtube_url):
    # Parse the generated text to extract title and byline
    lines = article_text.strip().split('\n')
    title = lines[0].replace("HEADLINE: ", "").replace("# ", "").strip()
    byline = lines[1].replace("BYLINE: ", "").strip()
    
    # Extract content (everything after the byline and before "ABOUT THE AUTHOR")
    content_start = 2
    content_end = len(lines)
    for i, line in enumerate(lines):
        if "ABOUT THE AUTHOR" in line:
            content_end = i
            break
            
    content = "\n".join(lines[content_start:content_end]).strip()
    author_promotion = "\n".join(lines[content_end:]).strip()

    payload = {
        "title": title,
        "byline": byline,
        "content": content,
        "category": "Automated Dispatch",
        "author_promotion": author_promotion,
        "api_key": "auto-agent-key"
    }

    print("Posting to GeorgeAnton.com...")
    res = requests.post(API_URL, json=payload)
    if res.status_code == 201:
        print("Success! Article published to the permanent record.")
    else:
        print(f"Failed to post: {res.text}")

def mold_article(article_filename, new_comments):
    file_path = os.path.join("ARTICLES", article_filename)
    if not os.path.exists(file_path):
        print(f"Error: Article {article_filename} not found.")
        return

    print(f"Molding article {article_filename} with new intelligence...")
    with open(file_path, "r", encoding="utf-8") as f:
        existing_content = f.read()

    comment_data = analyze_comments(new_comments)

    prompt = f"""
    You are an editor for "GeorgeAnton.com", a high-frequency, forensic media syndicate.
    Your task is to review the following previously published article and seamlessly inject/weave IN NEW INFORMATION derived from recent public comments.

    IMPORTANT: DO NOT destroy the historical record or completely rewrite the entire piece. Find graceful places to inject the new sentiment, correct the record if necessary, and maintain the original tone. Leave the BYLINE, HEADLINE, SPONSORED MESSAGE, and ABOUT THE AUTHOR blocks intact. Give it an Editor's Note at the very top (under the byline) indicating the piece was molded with new data.
    
    EXISTING ARTICLE TEXT:
    {existing_content}

    NEW COMMENT DATASTREAMS TO MOLD INTO THE ARTICLE:
    {comment_data}
    """

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.5,
        )
    )

    molded_content = response.text

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(molded_content)

    print(f"Success! {article_filename} has been molded and saved.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python auto_journalist.py <youtube_url> OR python auto_journalist.py mold <filename> <comment1> <comment2>...")
        sys.exit(1)
        
    command = sys.argv[1]
    
    if command == "mold":
        if len(sys.argv) < 4:
            print("Usage for mold: python auto_journalist.py mold <filename> <comment1> <comment2>...")
            sys.exit(1)
        filename = sys.argv[2]
        new_comments = sys.argv[3:]
        mold_article(filename, new_comments)
    else:
        url = sys.argv[1]
        article = generate_article(url)
        post_to_syndicate(article, url)
