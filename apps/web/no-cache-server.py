#!/usr/bin/env python3
"""
Lookup — server statico locale senza cache.

`python -m http.server` non invia intestazioni Cache-Control, quindi il
browser può servire copie obsolete di CSS/JS dalla propria cache euristica.
Questo script estende SimpleHTTPRequestHandler per disabilitare la cache,
così ogni ricarica preleva sempre i file aggiornati dal disco.

Uso:
    python3 no-cache-server.py [porta]

Esempio:
    python3 no-cache-server.py 8080
    # poi apri http://localhost:8080
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Handler che disabilita la cache del browser su ogni risposta."""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(('', port), NoCacheHandler)
    print(f'Lookup — server senza cache attivo su http://localhost:{port}')
    print('Premi Ctrl+C per fermare.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer fermato.')
        server.server_close()


if __name__ == '__main__':
    main()
