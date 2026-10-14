// Real production controllers with isolated empty local DB/Redis. No approval or authentication overrides.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if (fs.existsSync(path.join(root,'.env.local')) || fs.existsSync(path.join(root,'backend/.env.local')))
  throw new Error('Run in a clean worktree without .env.local; never load production credentials for this test.');
const env=Object.fromEntries(['PATH','HOME','TMPDIR','USER','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
let child;
if(process.argv[2]==='backend') {
  const jar=fs.readdirSync(path.join(root,'backend/build/libs')).find(f=>f.endsWith('.jar')&&!f.includes('plain'));
  if(!jar) throw new Error('Build bootJar first');
  child=spawn('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java',[
    '-jar',path.join(root,'backend/build/libs',jar),'--spring.config.import=',
    '--server.address=127.0.0.1','--server.port=18084',
    '--spring.datasource.url=jdbc:postgresql://127.0.0.1:55441/worker_login_test',
    '--spring.datasource.username=worker_login_test','--spring.datasource.password=local-fixture-only',
    '--spring.data.redis.host=127.0.0.1','--spring.data.redis.port=56391','--spring.data.redis.password=',
    '--spring.session.redis.namespace=sq:worker-login:test','--server.servlet.session.cookie.secure=false',
    '--safe-link.temporary-worker.sponsor-email=worker-login-sponsor@example.invalid',
    '--safe-link.cors.allowed-origins=http://localhost:3000,http://127.0.0.1:3000',
    '--safe-link.ai.vendor-enabled=false','--safe-link.storage.enabled=false','--safe-link.root-bootstrap.enabled=false',
  ],{cwd:root,env,stdio:'inherit'});
} else if(process.argv[2]==='frontend') {
  Object.assign(env,{SAFE_LINK_INTERNAL_API_BASE_URL:'http://127.0.0.1:18084',NEXT_PUBLIC_SAFE_LINK_API_BASE_URL:'http://127.0.0.1:18084',SAFE_LINK_PUBLIC_APP_URL:'http://localhost:3000',NEXT_PUBLIC_SAFE_LINK_APP_URL:'http://localhost:3000'});
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'],{cwd:root,env,stdio:'inherit'});
} else throw new Error('Use backend or frontend');
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
