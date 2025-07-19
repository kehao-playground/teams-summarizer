#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  yellow: '\x1b[33m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    console.log(`   Debug: Looking for ${fullPath} - not found`);
  }
  return exists;
}

function runCommand(command) {
  try {
    execSync(command, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function validateTask1() {
  log('🔍 正在驗證 Task 1 - Chrome Extension 專案結構...\n');

  const checks = [
    {
      name: 'Build process',
      check: () => runCommand('npm run build'),
      message: '建置是否成功完成'
    },
    {
      name: 'TypeScript compilation',
      check: () => runCommand('npm run type-check'),
      message: 'TypeScript 是否無錯誤'
    },
    {
      name: 'Manifest validation',
      check: () => {
        try {
          const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          return { success: manifest.manifest_version === 3 && manifest.name };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      message: 'manifest.json 是否有效'
    },
    {
      name: 'Built files',
      check: () => {
        const requiredFiles = [
          'dist/manifest.json',
          'dist/background.js',
          'dist/content.js',
          'dist/popup.js',
          'dist/popup.html',
          'dist/popup.css'
        ];
        return { success: requiredFiles.every(f => checkFileExists(f)) };
      },
      message: '所有建置後檔案是否存在'
    },
    {
      name: 'Source files',
      check: () => {
        const requiredFiles = [
          'src/background/background.ts',
          'src/content/content.ts',
          'src/popup/popup.ts',
          'src/popup/popup.html',
          'webpack.config.js',
          'tsconfig.json'
        ];
        return { success: requiredFiles.every(f => checkFileExists(f)) };
      },
      message: '所有原始檔案是否存在'
    }
  ];

  let passed = 0;
  let total = checks.length;

  checks.forEach(({ name, check, message }) => {
    const result = check();
    if (result.success) {
      log(`✅ ${message}`, colors.green);
      passed++;
    } else {
      log(`❌ ${message}`, colors.red);
      if (result.error) {
        log(`   錯誤: ${result.error}`, colors.yellow);
      }
    }
  });

  log(`\n📊 Task 1 驗證結果: ${passed}/${total} 檢查通過`);
  
  if (passed === total) {
    log('\n🎉 Task 1 完成！專案結構已正確設置', colors.green);
    process.exit(0);
  } else {
    log('\n⚠️  Task 1 未完成，請修正上述問題', colors.red);
    process.exit(1);
  }
}

validateTask1();