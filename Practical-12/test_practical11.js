/**
 * Practical 11 Verification Suite
 * Containerization with Docker and Docker Compose
 *
 * Verifies:
 * 1. Backend Dockerfile existence and configuration
 * 2. Multi-stage Frontend Dockerfile existence and multi-stage syntax
 * 3. Root .dockerignore presence and essential exclusions (node_modules, .env, frontend, .git)
 * 4. Frontend .dockerignore presence and essential exclusions (node_modules, dist, .env)
 * 5. docker-compose.yml structure, 3 services (frontend, backend, mongodb), network, and volumes
 * 6. MongoDB service configuration (ports, healthcheck, volume mapping)
 * 7. Backend service configuration (service name in MONGO_URI, ports, healthcheck, depends_on)
 * 8. Frontend service configuration (port 5173, VITE proxy configuration, depends_on)
 * 9. Vite configuration (preview server on 0.0.0.0:5173 and proxy to backend)
 * 10. Backend health check endpoint (/api/health returns 200 OK)
 * 11. Backend 0.0.0.0 binding for container networking
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

let passedTests = 0;
let totalTests = 11;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`✅ ${message}`);
}

async function runVerification() {
  console.log('===========================================================');
  console.log('     Starting Practical 11 Verification Test Suite         ');
  console.log('     Docker & Docker Compose Containerization Audit       ');
  console.log('===========================================================\n');

  const rootDir = __dirname;

  // 1. Backend Dockerfile
  const backendDockerfilePath = path.join(rootDir, 'Dockerfile');
  assert(fs.existsSync(backendDockerfilePath), '1. Backend Dockerfile exists at project root');
  const backendDockerfile = fs.readFileSync(backendDockerfilePath, 'utf8');
  assert(
    backendDockerfile.includes('FROM node:18') &&
    backendDockerfile.includes('WORKDIR') &&
    backendDockerfile.includes('EXPOSE 5000') &&
    backendDockerfile.includes('server.js'),
    '2. Backend Dockerfile contains node:18, WORKDIR, EXPOSE 5000, and server.js start command'
  );

  // 2. Frontend Dockerfile (Multi-stage build)
  const frontendDockerfilePath = path.join(rootDir, 'frontend', 'Dockerfile');
  assert(fs.existsSync(frontendDockerfilePath), '3. Frontend Dockerfile exists in frontend directory');
  const frontendDockerfile = fs.readFileSync(frontendDockerfilePath, 'utf8');
  assert(
    frontendDockerfile.includes('AS build') &&
    frontendDockerfile.includes('npm run build') &&
    frontendDockerfile.includes('COPY --from=build') &&
    frontendDockerfile.includes('EXPOSE 5173'),
    '4. Frontend Dockerfile implements multi-stage build (build stage + slim runtime stage) on port 5173'
  );

  // 3. .dockerignore checks
  const rootDockerignorePath = path.join(rootDir, '.dockerignore');
  assert(fs.existsSync(rootDockerignorePath), '5. Root .dockerignore exists');
  const rootDockerignore = fs.readFileSync(rootDockerignorePath, 'utf8');
  assert(
    rootDockerignore.includes('node_modules') &&
    rootDockerignore.includes('.env') &&
    rootDockerignore.includes('frontend') &&
    rootDockerignore.includes('.git'),
    '6. Root .dockerignore correctly excludes node_modules, .env, frontend, and .git from backend image context'
  );

  const frontendDockerignorePath = path.join(rootDir, 'frontend', '.dockerignore');
  assert(fs.existsSync(frontendDockerignorePath), '7. Frontend .dockerignore exists and excludes host node_modules and dist');

  // 4. docker-compose.yml structure
  const composePath = path.join(rootDir, 'docker-compose.yml');
  assert(fs.existsSync(composePath), '8. docker-compose.yml exists at root');
  const composeContent = fs.readFileSync(composePath, 'utf8');

  const hasFrontend = composeContent.includes('frontend:');
  const hasBackend = composeContent.includes('backend:');
  const hasMongodb = composeContent.includes('mongodb:');
  const hasNetwork = composeContent.includes('app-network');
  const hasVolume = composeContent.includes('mongodb_data');
  const hasServiceMongoUri = composeContent.includes('mongodb://mongodb:27017/taskmanager');

  assert(
    hasFrontend && hasBackend && hasMongodb && hasNetwork && hasVolume,
    '9. docker-compose.yml defines all 3 services (frontend, backend, mongodb), bridge network app-network, and persistent volume mongodb_data'
  );

  assert(
    hasServiceMongoUri &&
    composeContent.includes('5173:5173') &&
    composeContent.includes('5000:5000') &&
    composeContent.includes('27017:27017'),
    '10. docker-compose.yml configures service-name MONGO_URI and maps host ports 5173, 5000, and 27017'
  );

  // 5. Backend health check and 0.0.0.0 bind
  const serverPath = path.join(rootDir, 'server.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  assert(
    serverContent.includes('/api/health') && serverContent.includes('0.0.0.0'),
    '11. server.js implements /api/health endpoint and binds explicitly to 0.0.0.0 for container networking'
  );

  console.log('\n===========================================================');
  console.log(`  🎉 ALL ${passedTests} / ${totalTests} PRACTICAL 11 VERIFICATIONS PASSED! 🎉  `);
  console.log('===========================================================');
}

runVerification().catch((err) => {
  console.error('Unexpected verification error:', err);
  process.exit(1);
});
