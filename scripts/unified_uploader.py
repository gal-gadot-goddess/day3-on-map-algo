import os
import sys
import json
import hashlib
from pathlib import Path

# Add the root directory to sys.path
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

from upload.upload_instagram import upload_to_instagram
from upload.upload_facebook import upload_to_facebook, upload_to_facebook_story
from upload.upload_threads import upload_to_threads
from upload.upload_twitter import upload_to_twitter
from upload.upload_to_youtube import upload_to_youtube, update_channel_description
from upload.upload_vk import upload_to_vk
from upload.upload_telegram import upload_to_telegram

HISTORY_FILE = Path("upload_history.json")

def load_history():
    if not HISTORY_FILE.exists():
        return {}
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def save_history(history):
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2)

def get_content_hash(topic):
    return hashlib.md5(topic.encode('utf-8')).hexdigest()

def is_uploaded(history, content_hash, platform):
    if content_hash not in history:
        return False
    return platform in history[content_hash]

def mark_uploaded(history, content_hash, platform):
    if content_hash not in history:
        history[content_hash] = []
    if platform not in history[content_hash]:
        history[content_hash].append(platform)
    save_history(history)

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/unified_uploader.py <video_path>")
        sys.exit(1)

    video_path = Path(sys.argv[1])
    metadata_path = Path('metadata.json')

    if not video_path.exists():
        print(f"❌ Video not found at {video_path}")
        return


    # Try to read from current_topic.json first (AI-generated)
    topic_path = Path("src/data/current_topic.json")
    if topic_path.exists():
        with open(topic_path, "r", encoding="utf-8") as f:
            topic_data = json.load(f)
        title = topic_data.get("title", "Algorithm Visualization")
        desc = topic_data.get("description", "")
        htags = topic_data.get("hashtags", "#pathfinding #algorithm #coding")
        if isinstance(htags, list):
            hashtags = " ".join(htags)
        else:
            hashtags = htags
        ig_caption = desc
        fb_caption = desc
        threads_caption = desc
        yt_description = desc
    elif metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        title = metadata.get("title", "Algorithm Visualization")
        ig_caption = metadata.get("ig_caption", "")
        fb_caption = metadata.get("fb_caption", "")
        threads_caption = metadata.get("threads_caption", "")
        yt_description = metadata.get("yt_description", "")
        hashtags = metadata.get("hashtags", "")
        if isinstance(hashtags, list):
            hashtags = " ".join(hashtags)
    else:
        print("No topic or metadata found!")
        sys.exit(1)

    algo = topic_data.get("algo", "") if topic_path.exists() else metadata.get("algo", "")

    # Platform-specific, engaging captions (keeps titles unique and descriptive)
    instagram_full = (
        f"{title}\n\n"
        f"{ig_caption}\n\n"
        f"👨‍💻 Watch how {algo or 'this algorithm'} works on a real map in {topic_data.get('city', '')}.\n"
        f"🔥 Follow for daily pathfinding visualizations.\n"
        f"💬 Comment your favorite algorithm below!\n\n"
        f"{hashtags}"
    )
    facebook_full = (
        f"{title}\n\n"
        f"{fb_caption}\n\n"
        f"🎯 Learn {algo or 'pathfinding'} with real-world maps.\n"
        f"📌 Save this video for your coding journey.\n"
        f"👍 Like & Share if you found it useful.\n"
        f"💬 Which city should we visualize next?\n\n"
        f"{hashtags}"
    )
    threads_full = (
        f"{title}\n\n"
        f"{threads_caption}\n\n"
        f"{hashtags}"
    )

    content_hash = get_content_hash(f"UnifiedUpload_{title}")
    history = load_history()

    print(f"\n{'='*40}")
    print(f"🚀 PUBLISHING VIZ: {title}")
    print(f"{'='*40}")
    print(f"📂 Video Path: {video_path}")
    print(f"🔑 Content Hash: {content_hash}\n")

    # 1. Instagram Reel
    if not is_uploaded(history, content_hash, 'instagram_reel'):
        print("📸 Starting Instagram Reel...")
        try:
            upload_to_instagram(str(video_path), instagram_full, is_story=False)
            mark_uploaded(history, content_hash, 'instagram_reel')
            print("✅ Instagram Reel Success")
        except Exception as e: print(f"❌ Instagram Reel failed: {e}")
    else: print("⏭️ Skipping Instagram Reel")

    # 2. Instagram Story
    if not is_uploaded(history, content_hash, 'instagram_story'):
        print("📸 Starting Instagram Story...")
        try:
            upload_to_instagram(str(video_path), f"{title}\n\n{algo} on a real map! #algorithm #coding", is_story=True)
            mark_uploaded(history, content_hash, 'instagram_story')
            print("✅ Instagram Story Success")
        except Exception as e: print(f"❌ Instagram Story failed: {e}")
    else: print("⏭️ Skipping Instagram Story")

    # 3. Facebook Reel
    if not is_uploaded(history, content_hash, 'facebook_reel'):
        print("📘 Starting Facebook Reel...")
        try:
            upload_to_facebook(str(video_path), facebook_full, title=title[:100])
            mark_uploaded(history, content_hash, 'facebook_reel')
            print("✅ Facebook Reel Success")
        except Exception as e: print(f"❌ Facebook Reel failed: {e}")
    else: print("⏭️ Skipping Facebook Reel")

    # 4. Facebook Story
    if not is_uploaded(history, content_hash, 'facebook_story'):
        print("📘 Starting Facebook Story...")
        try:
            res = upload_to_facebook_story(str(video_path))
            if isinstance(res, dict) and res.get('status') == 'success':
                mark_uploaded(history, content_hash, 'facebook_story')
                print("✅ Facebook Story Success")
            else:
                # Some versions of script return string on success. Marking if no exception
                mark_uploaded(history, content_hash, 'facebook_story')
                print(f"✅ Facebook Story Success (or warn: {res})")
        except Exception as e: print(f"❌ Facebook Story failed: {e}")
    else: print("⏭️ Skipping Facebook Story")

    # 5. Twitter / X
    if not is_uploaded(history, content_hash, 'twitter'):
        print("🐦 Starting Twitter...")
        try:
            short_caption = f"{title}\n\n{hashtags}"
            if len(short_caption) > 280:
                short_caption = short_caption[:277] + "..."
            upload_to_twitter(str(video_path), short_caption)
            mark_uploaded(history, content_hash, 'twitter')
            print("✅ Twitter Success")
        except Exception as e: print(f"❌ Twitter failed: {e}")
    else: print("⏭️ Skipping Twitter")

    # 6. YouTube Shorts
    if not is_uploaded(history, content_hash, 'youtube'):
        print("🎥 Starting YouTube Shorts...")
        try:
            # Set the channel About description once per cycle (keeps channel branded)
            try:
                update_channel_description()
            except Exception as e:
                print(f"⚠️ Channel description update skipped: {e}")
            # extract clean tags list
            tags_list = [t.strip('#') for t in hashtags.split()] if hashtags else []
            upload_to_youtube(str(video_path), title[:100], yt_description, tags_list)
            mark_uploaded(history, content_hash, 'youtube')
            print("✅ YouTube Success")
        except Exception as e: print(f"❌ YouTube failed: {e}")
    else: print("⏭️ Skipping YouTube")

    # 7. Threads
    if not is_uploaded(history, content_hash, 'threads'):
        print("🧵 Starting Threads...")
        try:
            upload_to_threads(str(video_path), threads_full)
            mark_uploaded(history, content_hash, 'threads')
            print("✅ Threads Success")
        except Exception as e: print(f"❌ Threads failed: {e}")
    else: print("⏭️ Skipping Threads")
    
    # 8. VK
    if not is_uploaded(history, content_hash, 'vk'):
        print("🇷🇺 Starting VK...")
        try:
            upload_to_vk(str(video_path), facebook_full, title=title[:128])
            mark_uploaded(history, content_hash, 'vk')
            print("✅ VK Success")
        except Exception as e: print(f"❌ VK failed: {e}")
    else: print("⏭️ Skipping VK")

    # 9. Telegram
    if not is_uploaded(history, content_hash, 'telegram'):
        print("✈️ Starting Telegram...")
        try:
            res = upload_to_telegram(str(video_path), f"<b>{title}</b>\n\n{yt_description}")
            if isinstance(res, dict) and res.get('status') != 'skipped':
                mark_uploaded(history, content_hash, 'telegram')
                print("✅ Telegram Success")
            elif res is None:
                # sometimes it returns none on success
                mark_uploaded(history, content_hash, 'telegram')
                print("✅ Telegram Success")
            else:
                 print(f"❌ Telegram failed (skipped): {res}")
        except Exception as e: print(f"❌ Telegram failed: {e}")
    else: print("⏭️ Skipping Telegram")

    print("\n✅ All platforms processed!")

if __name__ == "__main__":
    main()

