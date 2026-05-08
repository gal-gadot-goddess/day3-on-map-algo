"""
Facebook Reels Upload

Facebook Graph API for uploading Reels to Facebook Page.
Enhanced with comprehensive debugging and error handling.
"""

import os
import requests
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def upload_to_facebook(video_path, description, title="Algorithm Visualization"):
    """
    Upload video to Facebook Page as a Reel.
    
    Returns dict with upload status and details.
    """
    
    print("\n" + "=" * 60)
    print("📘 FACEBOOK UPLOAD STARTING")
    print("=" * 60)
    
    # Get credentials
    access_token = os.getenv('FACEBOOK_ACCESS_TOKEN') or os.getenv('FB_ACCESS_TOKEN')
    page_id = os.getenv('FACEBOOK_PAGE_ID') or os.getenv('FB_PAGE_ID')
    
    # Debug info (masked)
    def mask(s): return f"{s[:4]}...{s[-4:]}" if s and len(s) > 8 else ("PLACEHOLDER (***)" if s == "***" else "MISSING")
    print(f"[facebook] Page ID: {page_id}")
    print(f"[facebook] Access Token: {mask(access_token)}")

    if not access_token:
        error_msg = "❌ FACEBOOK_ACCESS_TOKEN not set in environment variables"
        print(f"[facebook] {error_msg}")
        raise ValueError(error_msg)
    
    if not page_id:
        error_msg = "❌ FACEBOOK_PAGE_ID not set in environment variables"
        print(f"[facebook] {error_msg}")
        raise ValueError(error_msg)
    
    print(f"[facebook] ✅ Credentials loaded")
    
    # Check video file
    video_path_obj = Path(video_path)
    if not video_path_obj.exists():
        error_msg = f"❌ Video file not found: {video_path}"
        print(f"[facebook] {error_msg}")
        raise FileNotFoundError(error_msg)
    
    file_size_mb = video_path_obj.stat().st_size / (1024 * 1024)
    print(f"[facebook] ✅ Video file found: {video_path}")
    print(f"[facebook] Video size: {file_size_mb:.2f} MB")
    
    # Upload video
    print(f"[facebook] 🚀 Uploading to Facebook Page...")
    # Using v21.0 as it's verified working in the root script
    url = f"https://graph.facebook.com/v21.0/{page_id}/videos"
    
    try:
        with open(video_path, 'rb') as video:
            files = {'file': video}
            data = {
                'access_token': access_token,
                'description': description,
                'title': title,
                'is_explicit_share': True,
                'is_reel': True
            }
            
            print(f"[facebook] Sending request to Facebook API...")
            response = requests.post(url, files=files, data=data, timeout=300)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                video_id = result.get('id')
                
                print(f"[facebook] ✅ SUCCESS! Video uploaded!")
                print(f"[facebook] Video ID: {video_id}")
                print(f"[facebook] Check your Facebook Page to see the post!")
                print("=" * 60)
                
                return {
                    'id': video_id,
                    'platform': 'facebook',
                    'status': 'success',
                    'url': f"https://facebook.com/{video_id}"
                }
            else:
                # Handle error response
                error_data = response.json() if response.text else {}
                error_msg = error_data.get('error', {}).get('message', 'Unknown error')
                error_code = error_data.get('error', {}).get('code', 'N/A')
                
                print(f"[facebook] ❌ UPLOAD FAILED!")
                print(f"[facebook] Status Code: {response.status_code}")
                print(f"[facebook] Error Code: {error_code}")
                print(f"[facebook] Error Message: {error_msg}")
                print(f"[facebook] Full Response: {response.text[:500]}")
                print("=" * 60)
                
                raise Exception(f"Facebook API Error {response.status_code}: {error_msg}")
                
    except requests.exceptions.Timeout:
        error_msg = "⏱️ Upload timed out (video too large or slow connection)"
        print(f"[facebook] ❌ {error_msg}")
        print("=" * 60)
        raise Exception(error_msg)
        
    except requests.exceptions.ConnectionError as e:
        error_msg = f"🌐 Connection error: {str(e)}"
        print(f"[facebook] ❌ {error_msg}")
        print("=" * 60)
        raise Exception(error_msg)
        
    except Exception as e:
        print(f"[facebook] ❌ UNEXPECTED ERROR!")
        print(f"[facebook] Error type: {type(e).__name__}")
        print(f"[facebook] Error message: {str(e)}")
        print("=" * 60)
        raise

def upload_to_facebook_story(video_path):
    """
    Upload video to Facebook Page as a Story.
    Handles both legacy session flow and modern rupload flow.
    """
    print("\n" + "=" * 60)
    print("📘 FACEBOOK STORY UPLOAD STARTING")
    print("=" * 60)

    # Get credentials
    access_token = os.getenv('FACEBOOK_ACCESS_TOKEN') or os.getenv('FB_ACCESS_TOKEN')
    page_id = os.getenv('FACEBOOK_PAGE_ID') or os.getenv('FB_PAGE_ID')

    if not access_token or not page_id:
        raise ValueError("[facebook] Missing FACEBOOK_ACCESS_TOKEN or FACEBOOK_PAGE_ID")

    print(f"[facebook] Page ID: {page_id}")
    
    video_path_obj = Path(video_path)
    if not video_path_obj.exists():
        raise FileNotFoundError(f"[facebook] Video not found: {video_path}")

    try:
        file_size = video_path_obj.stat().st_size
        
        # Step 1: Initialize Upload
        print(f"[facebook] Step 1: Initiating story upload...")
        init_url = f"https://graph.facebook.com/v21.0/{page_id}/video_stories"
        init_data = {
            'access_token': access_token,
            'upload_phase': 'start',
            'file_size': file_size
        }
        res_init = requests.post(init_url, data=init_data, timeout=30)
        
        if res_init.status_code != 200:
             print(f"[facebook] ❌ Init Error: {res_init.text}")
             raise Exception(f"Facebook Story Init Failed: {res_init.text}")

        init_json = res_init.json()
        upload_url = init_json.get('upload_url')
        video_id = init_json.get('video_id')
        upload_session_id = init_json.get('upload_session_id')

        if not upload_url and not upload_session_id:
             raise Exception(f"No upload method returned. Response: {init_json}")

        if upload_url:
            # Modern rupload flow (as seen in some Page responses)
            print(f"[facebook] Using modern rupload flow...")
            headers = {
                'Authorization': f'OAuth {access_token}',
                'offset': '0',
                'file_size': str(file_size),
                'Content-Type': 'application/octet-stream'
            }
            with open(video_path, 'rb') as f:
                res_transfer = requests.post(upload_url, data=f, headers=headers, timeout=600)
                print(f"[facebook] Transfer status: {res_transfer.status_code}")
            
            # Finalize via finish phase
            print(f"[facebook] Step 3: Publishing story...")
            publish_url = f"https://graph.facebook.com/v21.0/{page_id}/video_stories"
            publish_data = {
                'access_token': access_token,
                'upload_phase': 'finish',
                'video_id': video_id
            }
            res_finish = requests.post(publish_url, data=publish_data, timeout=60)
        else:
            # Legacy Session Flow
            print(f"[facebook] Using legacy session flow...")
            transfer_url = f"https://graph.facebook.com/v21.0/{page_id}/video_stories"
            with open(video_path, 'rb') as f:
                files = {'video_file_chunk': f}
                transfer_data = {
                    'access_token': access_token,
                    'upload_phase': 'transfer',
                    'start_offset': 0,
                    'upload_session_id': upload_session_id,
                    'video_id': video_id
                }
                res_transfer = requests.post(transfer_url, data=transfer_data, files=files, timeout=600)
                print(f"[facebook] Transfer status: {res_transfer.status_code}")
            
            # Step 3: Finish Upload
            print(f"[facebook] Step 3: Finishing story...")
            finish_data = {
                'access_token': access_token,
                'upload_phase': 'finish',
                'upload_session_id': upload_session_id,
                'video_id': video_id
            }
            res_finish = requests.post(transfer_url, data=finish_data, timeout=60)

        if res_finish.status_code == 200 or res_finish.json().get('success'):
            print(f"[facebook] ✅ SUCCESS! Story uploaded!")
            print(f"[facebook] Video ID: {video_id}")
            print("=" * 60)
            return {'id': video_id, 'platform': 'facebook_story', 'status': 'success'}
        else:
            print(f"[facebook] ❌ Finish Phase Error: {res_finish.text}")
            raise Exception(f"Finish Phase Failed: {res_finish.text}")

    except Exception as e:
        print(f"[facebook] ❌ ERROR: {e}")
        return {'status': 'failed', 'error': str(e)}

if __name__ == '__main__':
    # Test upload
    from pathlib import Path
    
    video_file = Path('output/final_video.mp4')
    if video_file.exists():
        try:
            # Test standard upload
            # result = upload_to_facebook(video_file, "Test")
            
            # Test Story upload (comment out above to test)
            upload_to_facebook_story(video_file)
            pass
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
