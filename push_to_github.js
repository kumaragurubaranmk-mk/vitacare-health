import { execSync } from 'child_process';

const GIT_EXE = 'C:\\Users\\GIRIVASU\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\\cmd\\git.exe';
const DEFAULT_REPO = 'kumaragurubaranmk-mk/vitacare-health';

let arg = process.argv[2];
let remoteUrl = '';

if (!arg) {
  remoteUrl = `https://github.com/${DEFAULT_REPO}.git`;
  console.log(`ℹ️ No argument passed, defaulting to: ${remoteUrl}`);
  console.log(`💡 Tip: If you have a GitHub Personal Access Token (PAT), run:\n   node push_to_github.js <YOUR_TOKEN>\n`);
} else if (arg.startsWith('ghp_') || arg.startsWith('github_pat_')) {
  // Argument is a token
  remoteUrl = `https://${arg}@github.com/${DEFAULT_REPO}.git`;
  console.log(`🔑 Using GitHub Personal Access Token for ${DEFAULT_REPO}`);
} else if (arg.startsWith('http://') || arg.startsWith('https://')) {
  remoteUrl = arg;
} else {
  // If user passed token without standard prefix
  remoteUrl = `https://${arg}@github.com/${DEFAULT_REPO}.git`;
}

try {
  try {
    execSync(`"${GIT_EXE}" remote remove origin`, { stdio: 'ignore' });
  } catch (e) {}

  // Mask token in logs for privacy
  const maskedUrl = remoteUrl.replace(/:([a-zA-Z0-9_~.-]+)@/, ':***@');
  console.log(`> Setting remote origin: ${maskedUrl}`);
  execSync(`"${GIT_EXE}" remote add origin "${remoteUrl}"`, { stdio: 'inherit' });

  console.log('> Staging and verifying all project files...');
  execSync(`"${GIT_EXE}" add .`, { stdio: 'inherit' });

  try {
    execSync(`"${GIT_EXE}" commit -m "Deploy VitaCare AI full stack to Render"`, { stdio: 'ignore' });
  } catch (e) {
    // nothing new to commit
  }

  console.log('> Pushing branch main to GitHub with --force (overwriting upload zip)...');
  execSync(`"${GIT_EXE}" push -u origin main --force`, { stdio: 'inherit' });

  console.log('\n=======================================================');
  console.log('🎉 SUCCESS: All VitaCare AI files pushed to GitHub!');
  console.log(`🔗 Repo: https://github.com/${DEFAULT_REPO}`);
  console.log('=======================================================');
  console.log('👉 Next Step in Render.com:');
  console.log('1. Go to your Render Dashboard (https://dashboard.render.com).');
  console.log('2. Select your service connected to vitacare-health.');
  console.log('3. Click "Manual Deploy" -> "Deploy latest commit".');
  console.log('4. Render will run `npm run build` & `npm start` automatically!');
} catch (err) {
  console.error('\n❌ Push failed:', err.message);
  console.log('\n💡 How to authenticate:');
  console.log('1. Generate a Personal Access Token on GitHub:');
  console.log('   https://github.com/settings/tokens/new');
  console.log('   (Select scope: "repo")');
  console.log('2. Run this command with your token:');
  console.log('   node push_to_github.js <YOUR_GITHUB_TOKEN>');
}
