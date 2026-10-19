"""juki.json（または att.json）の source ページを img/ に出し、images 欄を埋める。
使い方: python -X utf8 -I tools/make_images.py <PDFフォルダ>        … 重機（img/001-1.jpg）
        python -X utf8 -I tools/make_images.py <PDFフォルダ> att    … アタッチメント（img/att-<PDF名の印>-p<ページ>.jpg）"""
import hashlib, json, os, subprocess, sys
pdfdir = sys.argv[1]
att = len(sys.argv) > 2 and sys.argv[2] == "att"
path = "att.json" if att else "juki.json"
data = json.load(open(path, encoding="utf-8"))
here = os.path.dirname(os.path.abspath(__file__))
done = set()
for m in data:
    pages, imgs = [], []
    for s in m["source"]:
        if (s["file"], s["page"]) not in pages:
            pages.append((s["file"], s["page"]))
    tag = "none" if att or m["no"] is None else f'{m["no"]:03d}'
    for i, (f, p) in enumerate(pages, 1):
        # アタッチメントは1ページに何機種も載るので、同じページは1枚の画像を共有する（img/att-<PDF名の短い印>-p<ページ>.jpg）
        out = f"img/att-{hashlib.md5(f.encode()).hexdigest()[:8]}-p{p}.jpg" if att else f"img/{tag}-{i}.jpg"
        imgs.append(out)
        if out in done:
            continue
        done.add(out)
        subprocess.run([sys.executable, "-X", "utf8", "-I", os.path.join(here, "render_pages.py"),
                        os.path.join(pdfdir, f), str(p), out], check=True)
    m["images"] = imgs
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(sum(len(m["images"]) for m in data), "images")
