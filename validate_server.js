const http = require('http');
const {spawn} = require('child_process');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function request(urlPath, port) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);
  });
}

function waitForServerReady(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let output = '';
    let settled = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && !settled) {
        settled = true;
        cleanup();
        resolve({port: Number(match[1]), output});
      }
    };

    const onExit = (code) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`El servidor terminó antes de iniciar. Código: ${code}\n${output}`));
      }
    };

    const interval = setInterval(() => {
      if (Date.now() - startedAt > timeoutMs && !settled) {
        settled = true;
        cleanup();
        reject(new Error(`Timeout esperando arranque del servidor.\n${output}`));
      }
    }, 100);

    function cleanup() {
      clearInterval(interval);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('exit', onExit);
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', onExit);
  });
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    wait(2000),
  ]);
}

async function main() {
  const blocker = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('occupied');
  });

  await new Promise((resolve, reject) => {
    blocker.listen(4173, '127.0.0.1', (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const env = {...process.env};
  delete env.PORT;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const ready = await waitForServerReady(child);
    assert(ready.port !== 4173, 'El servidor no hizo fallback de puerto cuando 4173 estaba ocupado.');

    const indexResponse = await request('/', ready.port);
    const manifestResponse = await request('/manifest.webmanifest', ready.port);
    const workerResponse = await request('/sw.js', ready.port);
    const versionResponse = await request('/VERSION', ready.port);

    assert(indexResponse.statusCode === 200, 'index.html no respondió 200.');
    assert(indexResponse.body.includes('Calculadora DTF PRO'), 'index.html no contiene el título esperado.');
    assert(manifestResponse.statusCode === 200, 'manifest.webmanifest no respondió 200.');
    assert(String(manifestResponse.headers['content-type'] || '').includes('application/manifest+json'), 'manifest.webmanifest no devolvió el content-type esperado.');
    assert(workerResponse.statusCode === 200, 'sw.js no respondió 200.');
    assert(versionResponse.statusCode === 200, 'VERSION no respondió 200.');

    console.log('SERVIDOR OK');
    console.log('- Fallback automatico de puerto: OK');
    console.log('- index.html servido por HTTP: OK');
    console.log('- manifest.webmanifest servido con MIME correcto: OK');
    console.log('- sw.js y VERSION disponibles por HTTP: OK');
  } finally {
    await stopProcess(child);
    await new Promise((resolve) => blocker.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});