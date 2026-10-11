import os, threading, http.server, socketserver, functools
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH','/opt/pw-browsers')
ROOT='/home/claude/lorsia'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def serve(root=ROOT, port=8765):
    h=functools.partial(Q, directory=root)
    socketserver.TCPServer.allow_reuse_address=True
    s=socketserver.ThreadingTCPServer(('127.0.0.1',port),h)
    threading.Thread(target=s.serve_forever,daemon=True).start()
    return s
RES=[]
def check(name, cond, info=''):
    RES.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(info) if (info and not cond) else ''))
    return cond
