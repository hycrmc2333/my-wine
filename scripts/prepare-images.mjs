import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const project = path.resolve(import.meta.dirname, '..');
const root = path.resolve(option('--root') || path.join(project, 'dist'));
const backupRoot = path.resolve(option('--backup-root') || path.join(project, '../image-originals'));
const check = args.includes('--check');
const policy = JSON.parse(fs.readFileSync(path.join(project, 'image-policy.json')));
const framing = JSON.parse(fs.readFileSync(path.join(project, 'image-framing.json')));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const policyHash = digest(JSON.stringify(policy));
const manifestPath = path.join(root, 'assets/image-manifest.json');
const prior = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)).images : {};
const manifest = {policyHash, policy, images: {...prior}};
const issues = [];
const raster = /\.(webp|png|jpe?g|avif|gif|tiff?)$/i;
const ignored = new Set(['.git', 'node_modules', '.openai', 'scripts', 'tests']);
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => {
    if (item.name.startsWith('.') || ignored.has(item.name)) return [];
    const file = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error(`Refusing symlink in public assets: ${file}`);
    return item.isDirectory() ? walk(file) : raster.test(item.name) ? [file] : [];
  });
}
function magick(argv) { return execFileSync('magick', argv, {encoding: 'utf8', maxBuffer: 4e6}).trim(); }
function dimensions(file) {
  const parts = magick(['identify', '-format', '%w %h %[channels]', file]).split(' ');
  return {width: Number(parts[0]), height: Number(parts[1]), channels: parts.slice(2).join(' ')};
}
function backup(file, bytes, hash) {
  const key = `${hash}/${path.basename(file)}`;
  const target = path.join(backupRoot, key);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, {flag: 'wx'});
  if (digest(fs.readFileSync(target)) !== hash) throw new Error(`Original backup checksum failed: ${target}`);
  return key;
}
function checkRecord(file, relative, bytes, d) {
  const record = prior[relative];
  if (Math.max(d.width, d.height) > policy.maxEdge) issues.push(`${relative}: ${d.width}×${d.height} exceeds ${policy.maxEdge}px`);
  if (!record || record.outputHash !== digest(bytes) || record.policyHash !== policyHash) issues.push(`${relative}: run images:prepare; missing/stale image record`);
  if (relative.startsWith('assets/photos/')) {
    const frame = framing.photos[relative];
    if (!record?.framed || !frame || record.frameHash !== digest(JSON.stringify(frame))) issues.push(`${relative}: photo framing needs review`);
  }
  return record;
}
if (backupRoot === root || backupRoot.startsWith(root + path.sep)) throw new Error('Originals must be stored outside the public directory');
for (const forbidden of ['image-originals', 'artwork-originals']) if (fs.existsSync(path.join(root, forbidden))) throw new Error(`Originals must not be published: ${forbidden}`);
const files = walk(root);
let changed = 0, before = 0, after = 0;
for (const [index, file] of files.entries()) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const bytes = fs.readFileSync(file), inputHash = digest(bytes), existing = prior[relative];
  const d = dimensions(file); before += bytes.length;
  if (check) {checkRecord(file, relative, bytes, d); after += bytes.length; continue;}
  const frame = framing.photos[relative];
  const frameHash = frame ? digest(JSON.stringify(frame)) : null;
  if (existing?.outputHash === inputHash && existing.policyHash === policyHash && existing.frameHash === frameHash) {
    manifest.images[relative] = existing; after += bytes.length; continue;
  }
  let source = file, sourceBytes = bytes, sourceHash = inputHash;
  if (existing?.outputHash === inputHash) {
    source = path.join(backupRoot, existing.backupKey);
    sourceBytes = fs.readFileSync(source); sourceHash = digest(sourceBytes);
    if (sourceHash !== existing.sourceHash) throw new Error(`Original source checksum failed: ${relative}`);
  }
  const backupKey = backup(file, sourceBytes, sourceHash);
  const sourceDimensions = dimensions(source);
  const tmp = path.join(path.dirname(file), `.prepare-${process.pid}-${path.basename(file)}`);
  let transform, subjectBounds = null, framed = false;
  if (relative.startsWith('assets/illustrations/')) {
    if (!sourceDimensions.channels.includes('a')) throw new Error(`Illustration needs a transparent subject: ${relative}`);
    const bounds = magick([source, '-alpha', 'extract', '-threshold', '5%', '-format', '%@', 'info:']);
    const match = bounds.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
    if (!match || !Number(match[1]) || !Number(match[2])) throw new Error(`Cannot find illustration subject: ${relative}`);
    const [,w,h,x,y] = match.map(Number); subjectBounds = {x,y,width:w,height:h};
    transform = ['-crop', bounds, '+repage', '-resize', `${policy.subjectEdge}x${policy.subjectEdge}>`, '-gravity', 'center', '-background', 'none', '-extent', `${policy.maxEdge}x${policy.maxEdge}`];
    framed = true;
  } else if (relative.startsWith('assets/photos/') && frame?.sourceHash === sourceHash) {
    const [x,y,w,h] = frame.bounds;
    if (![x,y,w,h].every(Number.isFinite) || w <= 0 || h <= 0 || x < 0 || y < 0 || x+w > 1.001 || y+h > 1.001) throw new Error(`Invalid photo bounds: ${relative}`);
    subjectBounds = {x:x*sourceDimensions.width, y:y*sourceDimensions.height, width:w*sourceDimensions.width, height:h*sourceDimensions.height};
    const cx=subjectBounds.x+subjectBounds.width/2, cy=subjectBounds.y+subjectBounds.height/2;
    const scale=policy.subjectEdge/Math.max(subjectBounds.width,subjectBounds.height);
    const cornerColor = magick([source, '-format', '%[pixel:p{0,0}]', 'info:']);
    transform = ['-background',cornerColor,'-virtual-pixel','background','-define',`distort:viewport=${policy.maxEdge}x${policy.maxEdge}+0+0`,'-distort','SRT',`${cx},${cy} ${Math.min(scale,1)} 0 ${policy.maxEdge/2},${policy.maxEdge/2}`,'+repage'];
    framed = true;
  } else {
    transform = ['-auto-orient','-resize',`${policy.maxEdge}x${policy.maxEdge}>`];
    if (relative.startsWith('assets/photos/')) issues.push(`${relative}: resized safely, but new/replaced photo still needs reviewed framing`);
  }
  try {
    magick([source, ...transform, '-strip', '-quality', String(policy.quality), '-define', 'webp:method=6', '-define', 'webp:alpha-quality=100', tmp]);
    const output = fs.readFileSync(tmp), outputDimensions=dimensions(tmp);
    if (Math.max(outputDimensions.width,outputDimensions.height)>policy.maxEdge) throw new Error(`Output exceeds image limit: ${relative}`);
    if (digest(fs.readFileSync(file)) !== inputHash) throw new Error(`File changed during preparation; kept concurrent edit: ${relative}`);
    fs.renameSync(tmp,file);
    manifest.images[relative]={sourceHash,backupKey,outputHash:digest(output),sourceBytes:sourceBytes.length,bytes:output.length,...outputDimensions,policyHash,frameHash,framed,subjectBounds};
    changed++; after+=output.length;
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  } finally { if(fs.existsSync(tmp))fs.unlinkSync(tmp); }
  if ((index+1)%25===0) console.log(`Prepared ${index+1}/${files.length} images`);
}
if (!check) fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const summary={mode:check?'check':'prepare',root,images:files.length,changed,beforeBytes:before,afterBytes:after,maxEdge:policy.maxEdge,issues};
if (option('--report')) fs.writeFileSync(path.resolve(option('--report')),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if (check && issues.length) process.exitCode=1;
