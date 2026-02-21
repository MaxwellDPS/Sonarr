import { stopContainer } from './helpers/docker';
import { removeState } from './helpers/config';

async function globalTeardown() {
  console.log('\n=== E2E Global Teardown ===\n');

  stopContainer();
  removeState();

  console.log('\n=== Global Teardown Complete ===\n');
}

export default globalTeardown;
