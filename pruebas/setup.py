"""Prepara las páginas de prueba a partir de Codigo.gs e Index.html (carpeta superior).
Uso:  python setup.py   y luego   python -m http.server 8765   (dentro de esta carpeta)
"""
import os, shutil

here = os.path.dirname(os.path.abspath(__file__))
raiz = os.path.dirname(here)

shutil.copy(os.path.join(raiz, 'Codigo.gs'), os.path.join(here, 'codigo.js'))
html = open(os.path.join(raiz, 'Index.html'), encoding='utf-8').read()
inyeccion = ('<script src="gas_mock.js"></script><script src="datos.js"></script>'
             '<script src="codigo.js"></script><script src="bridge.js"></script>\n')
etiqueta = '<script type="application/json" id="datosServidor"><?!= datosIniciales ?></script>'
assert etiqueta in html, 'Index.html no tiene la etiqueta de datos del servidor'
open(os.path.join(here, 'app.html'), 'w', encoding='utf-8').write(html.replace(etiqueta, inyeccion))
print('ok: abre http://127.0.0.1:8765/backend_tests.html y /frontend_tests.html')
