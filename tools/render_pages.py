"""PDF の指定ページを画像にする。
使い方: python -X utf8 -I tools/render_pages.py <pdf> <page(1始まり)> <out.jpg> [dpi]
dpi を省略すると掲載用（横1200px・JPEG品質70）。dpi を付けると読み取り用にその解像度で出す。
"""
import sys
import fitz

pdf, page, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
if page < 1:
    sys.exit("ページ番号は1以上")
p = fitz.open(pdf)[page - 1]
if len(sys.argv) > 4:
    p.get_pixmap(dpi=int(sys.argv[4])).save(out)
else:
    zoom = 1200 / p.rect.width
    p.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).save(out, jpg_quality=70)
