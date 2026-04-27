import os
import re
import json
import time
import random
import requests
from bs4 import BeautifulSoup
from PIL import Image, ExifTags
from io import BytesIO
from datetime import datetime

# Setup paths
BASE_DIR = 'worker_house_bff/scripts/wechat-article-archive/batch-2026-04-26'
ARTICLES_DIR = os.path.join(BASE_DIR, 'articles')
os.makedirs(ARTICLES_DIR, exist_ok=True)

URLS = [
    "https://mp.weixin.qq.com/s/U_Z3cyiakjrgweybmw-dqw",
    "https://mp.weixin.qq.com/s/JWNWmibaWUdkKwhtCWPbAw",
    "https://mp.weixin.qq.com/s/pNocff0geDjmhvCdleCgNA",
    "https://mp.weixin.qq.com/s/vmFEt01bvf2lFIK_qCzTNw",
    "https://mp.weixin.qq.com/s/x-RdJvFDNAIzuHKbRxDt4g",
    "https://mp.weixin.qq.com/s/9m7lvzUXrAMpzUXDcNXCbg",
    "https://mp.weixin.qq.com/s/HgsHZwsjSMzUERzRLdh2-w",
    "https://mp.weixin.qq.com/s/hBBruUbTavNwry2kxS1fdg",
    "https://mp.weixin.qq.com/s/tNzx-OSTnRp-uQYT8BRUIg",
    "https://mp.weixin.qq.com/s/a4-gTnB5OCR5Qh2opOAYjw",
    "https://mp.weixin.qq.com/s/hNcFfPSdbSIJIffgwtAiiQ",
    "https://mp.weixin.qq.com/s/WzGebwBnnrj1GKwb3eQdvw",
    "https://mp.weixin.qq.com/s/GoEnKk_6D8Dq8fyBhaZFAg",
    "https://mp.weixin.qq.com/s/wi0Du7BxDB9Wty2CaGnj8A",
    "https://mp.weixin.qq.com/s/dCkH4-5hhr3VQL_vKId0ew",
    "https://mp.weixin.qq.com/s/gRGVZvtQ-W8YceOK11TfZw",
    "https://mp.weixin.qq.com/s/EhGl4u9gN8izf3Xh7zLk4g",
    "https://mp.weixin.qq.com/s/-ST3nBrJXJBIozkAfbOdCQ",
    "https://mp.weixin.qq.com/s/oteVpQWrkfdkf6RThZ5Bag",
    "https://mp.weixin.qq.com/s/W8EDxPGSjEe-CIsfoLfp9g",
    "https://mp.weixin.qq.com/s/QdXRkp-SU_ZjOYBLBWlSkA",
    "https://mp.weixin.qq.com/s/CSkdu7DA4oXwY_DUXJhW0A",
    "https://mp.weixin.qq.com/s/f5cB0c4bY7SefCrE2aL2iw",
]

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"

def fix_exif_rotation(img):
    try:
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation] == 'Orientation':
                break
        exif = img._getexif()
        if exif is not None:
            if orientation in exif:
                if exif[orientation] == 3:
                    img = img.rotate(180, expand=True)
                elif exif[orientation] == 6:
                    img = img.rotate(270, expand=True)
                elif exif[orientation] == 8:
                    img = img.rotate(90, expand=True)
    except Exception:
        pass
    return img

def process_image(url, save_path):
    headers = {
        'User-Agent': UA,
        'Referer': 'https://mp.weixin.qq.com/'
    }
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    
    img = Image.open(BytesIO(resp.content))
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    img = fix_exif_rotation(img)
    
    # Resize max edge to 1200
    w, h = img.size
    if max(w, h) > 1200:
        if w > h:
            new_w = 1200
            new_h = int(1200 * h / w)
        else:
            new_h = 1200
            new_w = int(1200 * w / h)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
    quality = 80
    while True:
        buf = BytesIO()
        img.save(buf, format='JPEG', quality=quality)
        if buf.tell() <= 200 * 1024 or quality <= 40:
            with open(save_path, 'wb') as f:
                f.write(buf.getvalue())
            return buf.tell()
        quality -= 10

def main():
    results = []
    failed = []
    total_images = 0
    total_image_size = 0
    
    for idx, url in enumerate(URLS):
        index = idx + 1
        slug_match = re.search(r'/s/([^&]{8})', url)
        slug = slug_match.group(1) if slug_match else f"unknown-{index}"
        
        print(f"[{index}/{len(URLS)}] Fetching {url}")
        
        try:
            time.sleep(random.uniform(1.0, 2.0))
            
            headers = {'User-Agent': UA}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            html = resp.text
            
            article_dir = os.path.join(ARTICLES_DIR, f"{index:02d}-{slug}")
            images_dir = os.path.join(article_dir, "images")
            os.makedirs(images_dir, exist_ok=True)
            
            with open(os.path.join(article_dir, 'article.html'), 'w', encoding='utf-8') as f:
                f.write(html)
                
            soup = BeautifulSoup(html, 'html.parser')
            
            # Title
            title_match = re.search(r"var msg_title = '(.*?)';", html)
            if title_match:
                title = title_match.group(1).replace('\\x26', '&').replace('\\x22', '"').replace('\\x27', "'")
            else:
                title_elem = soup.find('h1', class_='rich_media_title')
                title = title_elem.text.strip() if title_elem else f"Article {index}"
                
            if 'original_title' in html and not title:
                title = re.search(r"var original_title = '(.*?)';", html).group(1)
            
            # Publish time
            ct_match = re.search(r'var ct = "(\d+)";', html)
            publish_time = ""
            publish_date_only = ""
            if ct_match:
                dt = datetime.fromtimestamp(int(ct_match.group(1)))
                publish_time = dt.strftime('%Y-%m-%d %H:%M')
                publish_date_only = dt.strftime('%Y-%m-%d')
                
            # Content
            content_div = soup.find(id='js_content')
            if not content_div:
                raise Exception("Cannot find #js_content")
                
            full_text = content_div.get_text(separator='\n', strip=True)
            summary = full_text[:120].replace('\n', ' ') + "..." if full_text else ""
            
            # Images
            imgs = content_div.find_all('img')
            images_data = []
            img_seq = 1
            seen_urls = set()
            
            for img_tag in imgs:
                img_url = img_tag.get('data-src') or img_tag.get('src')
                if img_url and img_url.startswith('http') and 'mmbiz.qpic.cn' in img_url:
                    if img_url in seen_urls:
                        continue
                    seen_urls.add(img_url)
                    
                    try:
                        save_name = f"img-{img_seq:02d}.jpg"
                        save_path = os.path.join(images_dir, save_name)
                        size = process_image(img_url, save_path)
                        
                        images_data.append({
                            "seq": img_seq,
                            "remoteUrl": img_url,
                            "localPath": f"images/{save_name}"
                        })
                        total_images += 1
                        total_image_size += size
                        img_seq += 1
                    except Exception as e:
                        print(f"Error processing image {img_url}: {e}")
                        
            activity_type = "分享"
            if "疗愈" in title or "疗愈" in summary: activity_type = "疗愈"
            elif "观影" in title or "观影" in summary: activity_type = "观影"
            elif "手作" in title or "手作" in summary: activity_type = "手作"
            elif "游戏" in title or "游戏" in summary: activity_type = "游戏"
            elif "deeptalk" in title.lower() or "deeptalk" in summary.lower(): activity_type = "deeptalk"
            elif "放空" in title or "无所事事" in title: activity_type = "放空"
            
            meta = {
                "index": index,
                "slug": slug,
                "url": url,
                "title": title,
                "publishTime": publish_time,
                "publishDateOnly": publish_date_only,
                "account": "社畜没有派对WorkerParty",
                "summary": summary,
                "fullText": full_text,
                "imageCount": len(images_data),
                "images": images_data,
                "coverLocalPath": images_data[0]["localPath"] if images_data else "",
                "activityHint": {
                    "guessedDate": publish_date_only,
                    "guessedLocation": "深圳南山大新 社畜快乐屋",
                    "activityType": activity_type,
                    "titleForMiniProgram": title[:20]
                }
            }
            
            with open(os.path.join(article_dir, 'meta.json'), 'w', encoding='utf-8') as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
                
            results.append(meta)
            
        except Exception as e:
            print(f"Failed to process {url}: {e}")
            failed.append({
                "url": url,
                "error": str(e)
            })
            
    # Save index.json
    with open(os.path.join(BASE_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    if failed:
        with open(os.path.join(BASE_DIR, 'failed.json'), 'w', encoding='utf-8') as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
            
    # Generate CONTENT.md
    with open(os.path.join(BASE_DIR, 'CONTENT.md'), 'w', encoding='utf-8') as f:
        f.write(f"# WeChat Articles Archive (Batch 2026-04-26)\n\n")
        f.write(f"- **抓取时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **成功/总数**: {len(results)}/{len(URLS)}\n")
        f.write(f"- **失败数**: {len(failed)}\n")
        f.write(f"- **总图片数**: {total_images}\n")
        f.write(f"- **总体积**: {total_image_size / 1024 / 1024:.2f} MB\n\n")
        
        if failed:
            f.write("## ❌ 抓取失败列表\n\n")
            for fail in failed:
                f.write(f"- {fail['url']} : {fail['error']}\n")
            f.write("\n")
            
        f.write("## 📄 抓取成功列表 (按原文发布顺序倒序)\n\n")
        
        results_sorted = sorted(results, key=lambda x: x['publishTime'], reverse=True)
        for res in results_sorted:
            f.write(f"### {res['index']:02d}. {res['title']}\n")
            f.write(f"- **原文链接**: {res['url']}\n")
            f.write(f"- **发布时间**: {res['publishTime']}\n")
            f.write(f"- **推测活动日期**: {res['activityHint']['guessedDate']}\n")
            f.write(f"- **图片数量**: {res['imageCount']}\n")
            f.write(f"- **建议封面**: `{res['coverLocalPath']}`\n")
            f.write(f"- **摘要**: {res['summary']}\n\n")
            f.write("#### 历史活动映射草案 (Phase 2 供参考)\n")
            f.write("```typescript\n")
            f.write("{\n")
            date_str = res['publishDateOnly'].replace('-', '')
            f.write(f'  id: "past-{date_str}-{res["slug"]}",\n')
            f.write(f'  title: "{res["activityHint"]["titleForMiniProgram"]}",\n')
            f.write(f'  date: "{res["activityHint"]["guessedDate"]}",\n')
            f.write(f'  location: "{res["activityHint"]["guessedLocation"]}",\n')
            f.write('  cover: "pending-cloudbase-upload",\n')
            f.write('  status: "ended",\n')
            f.write('  images: ["pending-cloudbase-upload"],\n')
            f.write(f'  description: "{res["summary"]}"\n')
            f.write("}\n")
            f.write("```\n\n")
            
        f.write("## 🚀 Phase 2 下一步建议\n\n")
        f.write("1. 把 `batch-2026-04-26/**/images/*.jpg` 上传到 CloudBase (可以使用迁移脚本或补一个 batch 版本)。\n")
        f.write("2. 替换 `meta.json` 和 `index.json` 里 `images` 的 `localPath` 为实际的 CloudBase URL。\n")
        f.write("3. 生成可直接 import 到 `worker_house/src/data/activities.ts` 的 `pastActivities` 片段。\n")

    print(f"\nDone! Success: {len(results)}, Failed: {len(failed)}")
    print(f"Total images: {total_images}, Total size: {total_image_size/1024/1024:.2f} MB")

if __name__ == '__main__':
    main()
