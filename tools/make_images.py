"""juki.json の source ページを img/ に出し、images 欄を埋める。
使い方: python -X utf8 -I tools/make_images.py <PDFフォルダ>"""
import json, os, subprocess, sys
pdfdir = sys.argv[1]
data = json.load(open("juki.json", encoding="utf-8"))
here = os.path.dirname(os.path.abspath(__file__))
for m in data:
    pages, imgs = [], []
    for s in m["source"]:
        if (s["file"], s["page"]) not in pages:
            pages.append((s["file"], s["page"]))
    tag = "none" if m["no"] is None else f'{m["no"]:03d}'
    for i, (f, p) in enumerate(pages, 1):
        out = f"img/{tag}-{i}.jpg"
        subprocess.run([sys.executable, "-X", "utf8", "-I", os.path.join(here, "render_pages.py"),
                        os.path.join(pdfdir, f), str(p), out], check=True)
        imgs.append(out)
    m["images"] = imgs
json.dump(data, open("juki.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(sum(len(m["images"]) for m in data), "images")
