"""
YouTube Upload Script - Updated for 2025

Uses refresh token from GitHub Secrets to upload videos.
"""

import os
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import datetime

def get_authenticated_service():
    """Authenticate using refresh token from environment."""
    
    # Get credentials from GitHub Secrets
    client_id = (os.getenv('YOUTUBE_CLIENT_ID') or os.getenv('YT_CLIENT_ID', '')).strip()
    client_secret = (os.getenv('YOUTUBE_CLIENT_SECRET') or os.getenv('YT_CLIENT_SECRET', '')).strip()
    refresh_token = (os.getenv('YOUTUBE_REFRESH_TOKEN') or os.getenv('YT_REFRESH_TOKEN', '')).strip()
    
    # Debug info (masked)
    def mask(s): return f"{s[:4]}...{s[-4:]}" if s and len(s) > 8 else "MISSING"
    print(f"[youtube] Client ID: {mask(client_id)}")
    print(f"[youtube] Client Secret: {mask(client_secret)}")
    print(f"[youtube] Refresh Token: {mask(refresh_token)}")

    if not all([client_id, client_secret, refresh_token]):
        raise ValueError(
            "Missing credentials! Set these environment variables:\n"
            "  - YOUTUBE_CLIENT_ID\n"
            "  - YOUTUBE_CLIENT_SECRET\n"
            "  - YOUTUBE_REFRESH_TOKEN"
        )
    
    # Create credentials from refresh token
    creds = Credentials(
        None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/youtube"]
    )
    
    try:
        # Refresh to get access token
        creds.refresh(Request())
    except Exception as e:
        if "invalid_grant" in str(e).lower():
            print("\n❌ [youtube] AUTH ERROR: Refresh token has EXPIRED or been REVOKED.")
            print("💡 SOLUTION: You must generate a NEW refresh token.")
            print("   1. Go to Google Cloud Console.")
            print("   2. Ensure your 'OAuth Consent Screen' is in 'Production' or add yourself as a test user.")
            print("   3. Run a local script to get a new refresh token.")
        raise
    
    return build('youtube', 'v3', credentials=creds)

def update_channel_description():
    """Set the channel (About) description on YouTube. The YouTube API requires
    brandingSettings to be updated in its own request, separate from snippet."""
    youtube = get_authenticated_service()
    try:
        # 1. Get channel id
        channels = youtube.channels().list(part='id,brandingSettings', mine=True).execute()
        if not channels.get('items'):
            print("[youtube] ⚠️ No channel found, skipping description update")
            return

        channel = channels['items'][0]
        channel_id = channel['id']

        description = (
            "Real map pathfinding visualizations — BFS, DFS, Dijkstra, A*, "
            "Greedy Best-First, Bidirectional BFS/Dijkstra/A* — rendered on "
            "real city street grids from OpenStreetMap. Learn how shortest-path "
            "algorithms work one video at a time. New video every day!"
        )

        # 2. Update brandingSettings in its own call (cannot be combined with snippet)
        branding = channel.get('brandingSettings', {}).get('channel', {})
        branding['description'] = description

        branding_body = {
            'id': channel_id,
            'brandingSettings': {
                'channel': branding
            }
        }
        youtube.channels().update(part='brandingSettings', body=branding_body).execute()
        print("[youtube] ✅ Channel description updated")
    except Exception as e:
        print(f"[youtube] ⚠️ Channel description update failed: {e}")

def upload_to_youtube(video_path, title, description, tags, category_id='22'):
    """Upload video to YouTube and return result."""
    youtube = get_authenticated_service()
    
    body = {
        'snippet': {
            'title': title,
            'description': description,
            'tags': tags,
            'categoryId': category_id
        },
        'status': {
            'privacyStatus': 'public',
            'selfDeclaredMadeForKids': False,
        }
    }
    
    if '#Shorts' not in body['snippet']['description']:
        body['snippet']['description'] += '\n\n#Shorts'
    
    media = MediaFileUpload(
        str(video_path),
        chunksize=-1,
        resumable=True,
        mimetype='video/mp4'
    )
    
    print(f"[youtube] Uploading: {title}")
    request = youtube.videos().insert(
        part=','.join(body.keys()),
        body=body,
        media_body=media
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[youtube] Progress: {int(status.progress() * 100)}%")
    
    print(f"[youtube] ✅ Uploaded! Video ID: {response['id']}")
    print(f"[youtube] URL: https://youtube.com/shorts/{response['id']}")
    
    return response

def main():
    """Upload the generated video to YouTube."""
    video_file = Path('output/final_video.mp4')
    
    if not video_file.exists():
        print("[youtube] ❌ No video found at output/final_video.mp4")
        return
    
    # Read the story and topic for title
    story_file = Path('output/story.txt')
    topic = ""
    
    if story_file.exists():
        story = story_file.read_text(encoding='utf-8')
        
        # Extract key phrase from first sentence for title
        first_sentence = story.split('.')[0] if '.' in story else story[:80]
        
        # Create short, catchy title (max 60 chars for mobile)
        title = first_sentence[:57] + "..." if len(first_sentence) > 60 else first_sentence
    else:
        title = "Girls Dating Rules"
    
    # Description for Shorts
    description = "#shorts #girlsdatingrules #datingrules #datingadvice #relationshiptips"
    
    tags = [
        'girlsdatingrules', 'datingrules', 'datingadvice', 
        'relationshiptips', 'womenwisdom'
    ]
    
    # Upload
    try:
        upload_to_youtube(
            video_path=video_file,
            title=title,
            description=description,
            tags=tags,
            category_id='22'
        )
    except Exception as e:
        print(f"[youtube] ❌ Upload failed: {e}")
        raise

if __name__ == '__main__':
    main()

