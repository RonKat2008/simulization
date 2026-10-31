// Explicit repository-root .env loading for both runtimes. Existing shell values win.
import {fileURLToPath} from 'node:url';
export function loadProjectEnv(path = fileURLToPath(new URL('../../../.env',import.meta.url))):void {
  try {process.loadEnvFile(path);}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
