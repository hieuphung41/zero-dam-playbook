"""Cache-busting: append ?v=<content hash> to the planner's script and image URLs so browsers never mix a new page with
old cached files (GitHub Pages serves everything with max-age=600). Run before every commit: python3 tools/stamp.py"""
import hashlib, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'map'
h = lambda f: hashlib.sha1((root / f).read_bytes()).hexdigest()[:10]
data = (root / 'data.js').read_text()
data = re.sub(r"src:'zero-dam\.jpg(\?v=[0-9a-f]+)?'", "src:'zero-dam.jpg?v=%s'" % h('zero-dam.jpg'), data)
(root / 'data.js').write_text(data)
html = (root / 'index.html').read_text()
for f in ('data.js', 'paths.js', 'poi.js', 'app.js'):
    html = re.sub(r'src="%s(\?v=[0-9a-f]+)?"' % re.escape(f), 'src="%s?v=%s"' % (f, h(f)), html)
(root / 'index.html').write_text(html)
print('stamped', re.findall(r'src="(\w+\.js\?v=[0-9a-f]+)"', html))
