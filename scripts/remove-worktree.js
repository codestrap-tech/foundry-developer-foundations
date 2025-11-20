const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function removeDockerContainer(containerName) {
  try {
    // Check if the container exists
    const existingContainers = execSync(
      `docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`
    ).toString();
    if (existingContainers.includes(containerName)) {
      console.log(`Removing Docker container: ${containerName}`);
      execSync(`docker rm -f ${containerName}`);
      console.log(`Container ${containerName} removed successfully.`);
    } else {
      console.log(`No Docker container found with the name: ${containerName}`);
    }
  } catch (error) {
    console.error('Error during Docker container removal:', error.message);
  }
}

function getAvailableWorktrees() {
  try {
    const worktreePath = path.join(process.cwd(), '.larry', 'worktrees');

    return fs.readdirSync(worktreePath).filter((dir) => {
      const fullPath = path.join(worktreePath, dir);
      return fs.statSync(fullPath).isDirectory();
    });
  } catch (error) {
    console.error('Error reading worktrees directory:', error.message);
    return [];
  }
}

function removeWorktrees(worktreeNames) {
  try {
    const worktreePath = path.join(process.cwd(), '.larry', 'worktrees');

    if (worktreeNames.includes('--all')) {
      // Remove all worktrees
      fs.readdirSync(worktreePath).forEach((dir) => {
        console.log(`Removing worktree: ${dir}`);
        const fullPath = path.join(worktreePath, dir);
        execSync(`rm -rf ${fullPath}`);
        removeDockerContainer(`larry-worktree-${dir}`);
      });
    } else {
      // Remove specified worktrees
      worktreeNames.forEach((name) => {
        const fullPath = path.join(worktreePath, name);
        if (fs.existsSync(fullPath)) {
          console.log(`Removing worktree: ${name}`);
          execSync(`rm -rf ${fullPath}`);
          removeDockerContainer(`larry-worktree-${name}`);
        } else {
          console.error(`Worktree "${name}" does not exist.`);
        }
      });
    }

    execSync(`git worktree prune`);
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during worktree removal:', error.message);
  }
}

function promptForWorktreeSelection() {
  return new Promise((resolve, reject) => {
    try {
      const availableWorktrees = getAvailableWorktrees();

      if (availableWorktrees.length === 0) {
        console.log('No worktrees found.');
        resolve([]);
        return;
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('\nAvailable worktrees:');
      availableWorktrees.forEach((worktree, index) => {
        console.log(`  ${index + 1}. ${worktree}`);
      });
      console.log(`  ${availableWorktrees.length + 1}. All`);
      console.log('  0. Cancel\n');

      rl.question(
        'Select worktree(s) to remove (comma-separated numbers, e.g., 1,3 or ' +
          (availableWorktrees.length + 1) +
          ' for all): ',
        (answer) => {
          try {
            rl.close();

            const selections = answer
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);

            if (selections.length === 0 || selections.includes('0')) {
              console.log('Cancelled.');
              resolve([]);
              return;
            }

            const selectedWorktrees = [];
            const allSelected = selections.includes(
              String(availableWorktrees.length + 1)
            );

            if (allSelected) {
              resolve(availableWorktrees);
              return;
            }

            selections.forEach((selection) => {
              const index = parseInt(selection, 10);
              if (index >= 1 && index <= availableWorktrees.length) {
                const worktree = availableWorktrees[index - 1];
                if (!selectedWorktrees.includes(worktree)) {
                  selectedWorktrees.push(worktree);
                }
              }
            });

            if (selectedWorktrees.length === 0) {
              console.log('No valid selections made.');
              resolve([]);
              return;
            }

            resolve(selectedWorktrees);
          } catch (error) {
            reject(error);
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  // Get arguments from command line
  const args = process.argv.slice(2);

  let worktreeNames = args;

  // If no arguments provided, prompt for selection
  if (args.length === 0) {
    worktreeNames = await promptForWorktreeSelection();

    if (worktreeNames.length === 0) {
      process.exit(0);
      return;
    }
  }

  removeWorktrees(worktreeNames);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
