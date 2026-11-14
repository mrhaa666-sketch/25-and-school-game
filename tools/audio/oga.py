"""OpenGameArt 搜索：python3 -I oga.py search "<关键词>" [type] | info <slug>...
type: 13=音效 12=音乐。只搜 CC0（license tid 4）。"""
import sys, re, json, html, urllib.parse, subprocess

def get(url):
    return subprocess.run(['curl', '-s', '-L', '-A', 'Mozilla/5.0', url], capture_output=True, text=True).stdout

def search(q, t='13'):
    u = 'https://opengameart.org/art-search-advanced?' + urllib.parse.urlencode({'keys': q, 'field_art_type_tid[]': t, 'field_art_licenses_tid[]': '4', 'sort_by': 'count', 'sort_order': 'DESC'})
    page = get(u)
    slugs = []
    for m in re.finditer(r'href="/content/([a-z0-9-]+)"', page):
        s = m.group(1)
        if s not in slugs and s not in ('faq',):
            slugs.append(s)
    return slugs

def info(slug):
    page = get('https://opengameart.org/content/' + slug)
    title = re.search(r'<title>(.*?)\|', page)
    block = page.split('field-name-field-art-licenses', 1)[1][:3000] if 'field-name-field-art-licenses' in page else ''
    lic = re.findall(r"license_images/([a-z0-9-]+)\.png", block)
    author = re.search(r'field-name-author-submitter.*?<a href="/users/([^"]+)"', page, re.S)
    files = re.findall(r'href="(https://opengameart.org/sites/default/files/[^"]+)"', page)
    files = list(dict.fromkeys(files))
    return {'slug': slug, 'title': html.unescape(title.group(1).strip()) if title else '', 'license': [html.unescape(x) for x in lic][:2],
            'author': author.group(1) if author else '', 'files': [f for f in files if re.search(r'\.(ogg|wav|mp3|flac|zip)$', f, re.I)]}

if __name__ == '__main__':
    if sys.argv[1] == 'search':
        for s in search(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '13')[:12]:
            print(s)
    else:
        for s in sys.argv[2:]:
            print(json.dumps(info(s), ensure_ascii=False))
