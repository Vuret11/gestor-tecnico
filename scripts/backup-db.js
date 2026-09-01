// Cron Job aparte en Render: hace un dump de la base de datos por la red
// interna (no necesita tráfico externo) y lo sube a Cloudinary.
const { execFile } = require('child_process');
const { promisify } = require('util');
const { mkdtemp, readFile, rm } = require('fs/promises');
const { join } = require('path');
const { tmpdir } = require('os');
const { v2: cloudinary } = require('cloudinary');

const execFileAsync = promisify(execFile);

async function main() {
  const { DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!DATABASE_URL) throw new Error('Falta la variable de entorno DATABASE_URL');
  if (!CLOUDINARY_CLOUD_NAME) throw new Error('Falta CLOUDINARY_CLOUD_NAME');

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  const fecha = new Date().toISOString().slice(0, 10);
  const dir = await mkdtemp(join(tmpdir(), 'backup-'));
  const dumpPath = join(dir, `backup-${fecha}.dump`);

  console.log(`Generando dump en ${dumpPath}...`);
  await execFileAsync('pg_dump', [DATABASE_URL, '--format=custom', '--file', dumpPath]);

  console.log('Subiendo a Cloudinary...');
  const buffer = await readFile(dumpPath);
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'gestor-tecnico/backups', resource_type: 'raw', public_id: `backup-${fecha}` },
      (error, res) => (error || !res ? reject(error ?? new Error('Upload failed')) : resolve(res)),
    );
    stream.end(buffer);
  });

  await rm(dir, { recursive: true, force: true });
  console.log(`Backup subido: ${result.secure_url}`);
}

main().catch(err => {
  console.error('Backup falló:', err);
  process.exit(1);
});
