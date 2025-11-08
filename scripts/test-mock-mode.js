#!/usr/bin/env node

/**
 * Quick test script to verify mock mode is working
 * Run with: node scripts/test-mock-mode.js
 */

console.log('🧪 Testing Mock Mode Configuration\n');

// Test 1: Check if .env.local exists
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '..', '.env.local');
const envMockPath = path.join(__dirname, '..', '.env.mock');

console.log('✓ Test 1: Check .env.mock exists');
if (fs.existsSync(envMockPath)) {
  console.log('  ✅ .env.mock file exists\n');
} else {
  console.log('  ❌ .env.mock file missing!\n');
  process.exit(1);
}

console.log('✓ Test 2: Check .env.local (mock mode active)');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  if (content.includes('EXPO_PUBLIC_MOCK_MODE=true')) {
    console.log('  ✅ Mock mode is ACTIVE (.env.local exists with EXPO_PUBLIC_MOCK_MODE=true)\n');
  } else {
    console.log('  ⚠️  .env.local exists but EXPO_PUBLIC_MOCK_MODE is not set to true\n');
  }
} else {
  console.log('  ℹ️  Mock mode is INACTIVE (.env.local does not exist)\n');
}

// Test 3: Check mock data files exist
console.log('✓ Test 3: Check mock data files');
const mockDataFiles = [
  'mock-data/predefinedDreams.ts',
  'mock-data/generators.ts',
  'mock-data/assets.ts',
];

let allMockFilesExist = true;
mockDataFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} missing!`);
    allMockFilesExist = false;
  }
});
console.log();

// Test 4: Check mock service files exist
console.log('✓ Test 4: Check mock service files');
const mockServiceFiles = [
  'services/mocks/geminiServiceMock.ts',
  'services/mocks/storageServiceMock.ts',
  'services/mocks/notificationServiceMock.ts',
];

let allServiceFilesExist = true;
mockServiceFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} missing!`);
    allServiceFilesExist = false;
  }
});
console.log();

// Test 5: Check real service files exist
console.log('✓ Test 5: Check real service files (backups)');
const realServiceFiles = [
  'services/geminiServiceReal.ts',
  'services/storageServiceReal.ts',
  'services/notificationServiceReal.ts',
];

let allRealFilesExist = true;
realServiceFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} missing!`);
    allRealFilesExist = false;
  }
});
console.log();

// Final summary
console.log('═══════════════════════════════════════');
if (allMockFilesExist && allServiceFilesExist && allRealFilesExist) {
  console.log('🎉 All mock mode files are in place!');
  console.log('\nTo start in mock mode: npm run start:mock');
  console.log('To start in real mode: npm run start:real');
} else {
  console.log('⚠️  Some files are missing. Please check the errors above.');
  process.exit(1);
}
console.log('═══════════════════════════════════════\n');
