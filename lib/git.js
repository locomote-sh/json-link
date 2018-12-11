//   Copyright 2018 Locomote Limited.
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

const Path = require('path');
const { spawn } = require('child_process');

/**
 * Run a git command.
 * @param cwd   The git command's working directory path.
 * @param args  Arguments to the git command.
 * @returns The command's exit code, stdout and stderr.
 */
function git( cwd, args ) {
    return new Promise( ( resolve, reject ) => {
        let proc = spawn('git', args, { cwd });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', data => stdout += data.toString() );
        proc.stderr.on('data', data => stderr += data.toString() );
        proc.on('close', code => resolve({ code, stdout, stderr }) );
        proc.on('error', reject );
    });
}

/**
 * Test if a path contains a bare repository.
 * @param path  The path to a potential git repository.
 * @returns Return boolean true if the path is a bare repository.
 */
async function isBare( path ) {
    try {
        let { stdout } = await git( path, ['rev-parse', '--is-bare-repository']);
        return stdout.trim() == 'true';
    }
    catch( e ) {}
    return false;
}

/**
 * Get the repository root for a file path.
 * @param path  A path to a file, potentially within a non-bare repository.
 * @returns The path to the root directory of the non-bare repository containing
 * the file, or null if the path isn't within a non-bare repository.
 */
async function getRoot( filePath ) {
    try {
        let dirPath = Path.dirname( filePath );
        let { stdout } = await git( dirPath, ['rev-parse', '--show-toplevel']);
        if( stdout ) {
            return stdout.trim();
        }
    }
    catch( e ) {}
    return null;
}

/**
 * Read the contents of a file within a repository.
 * @param repoDir   The path to a repository; can be bare or non-bare.
 * @param path      The path to a file within the repository, relative to the
 *                  repository root.
 * @param commitish (Optional) A commit hash or branch name. If provided then
 *                  the function will return the contents of the specific
 *                  version of the file at that point in the commit history;
 *                  otherwise, returns the version of the file on the 'master'
 *                  branch.
 */
async function read( repoDir, path, commitish ) {
    commitish = commitish || 'master';
    let { stdout } = await git( repoDir, ['show', `${commitish}:${path}`]);
    return stdout;
}

module.exports = {
    isBare,
    getRoot,
    read
};
