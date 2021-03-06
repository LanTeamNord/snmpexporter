import base64
import logging
import multiprocessing

import snmpexporter.target
import snmpexporter.poller
import snmpexporter.snmpimpl
import snmpexporter.annotator


class FakeResolver(object):

  def resolve(self, oid):
    _, iid = oid.rsplit('.', 1)
    return 'DUMMY-MIB::' + base64.b64encode(
        oid.encode('utf-8')).decode('utf-8') + '.' + iid, {}


# TODO(bluecmd): mibresolver and netsnmp are both using the same library.
# If they are in the same process they will compete about the output format
# which is a giant pain. We solve this by running them in seperate processes
# for now.
class ForkedResolver(object):

  def __init__(self):
    self.lock = multiprocessing.Lock()
    self.request = multiprocessing.Queue()
    self.response = multiprocessing.Queue()
    self.thread = multiprocessing.Process(target=self.run, daemon=True)
    self.thread.start()

  def resolve(self, oid):
    with self.lock:
      self.request.put(oid)
      return self.response.get()

  def run(self):
    logging.debug('Initializing MIB resolver')
    import mibresolver
    while True:
      request = self.request.get()
      self.response.put(mibresolver.resolve(request))
