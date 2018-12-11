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

const FS    = require('fs');
const Git   = require('./git');
const Path  = require('path');

/**
 * A file source reference. Encapsulates information about the file path,
 * version and git repo (if any) that contains it.
 */
class Source {

    /**
     * Construct a new source object.
     * @param repoPath  The root path of the repo containing the file; can
     *                  be null if the file isn't contained within a repo.
     * @param filePath  The path to the file; relative to the repo root if
     *                  contained within a repo. May optionally indictate
     *                  a file version by appending # followed by a git
     *                  commit-ish to the end of the file path.
     * @param commitish (Optional) a git commit-ish indicating the version
     *                  of the file being referenced. Only relevant when
     *                  the file is within a repo; any commit-ish specified
     *                  within the file path takes precedence.
     */
    constructor( repoPath, filePath, commitish ) {
        this.repoPath = repoPath;
        let idx = filePath.indexOf('#');
        if( idx ) {
            this.filePath = filePath.substring( 0, idx );
            this.commitish = filePath.substring( idx + 1 );
        }
        else {
            this.filePath = filePath;
            this.commitish = commitish;
        }
    }

    /**
     * Resolve a relative file source against this source.
     */
    resolve( ref ) {
        let filePath = ref instanceof Source ? ref.filePath : ref.toString();
        if( filePath[0] != '/' ) {
            filePath = Path.join( this.filePath, filePath );
        }
        return new Source( this.repoPath, filePath, this.commitish );
    }

    /**
     * Read the contents of the file referenced by this source.
     */
    read() {
        if( this.repoPath ) {
            // Read file from repository.
            return Git.read( this.repoPath, this.filePath, this.commitish );
        }
        // Read file from file system.
        return new Promise( ( resolve, reject ) => {
            FS.readFile( this.filePath, ( err, data ) => {
                if( err ) {
                    return reject( err );
                }
                resolve( data.toString() );
            });
        });
    }
}

/**
 * Parse a file source reference. Decides whether the reference
 * indicates a file within a bare or non-bare repo, or is a plain
 * file path.
 * @param ref   A string path or a previously parsed Source.
 * @returns An instance of Source.
 */
Source.parseSource = function( ref ) {
    if( ref instanceof Source ) {
        return ref;
    }
    let repoPath, filePath;
    // Check for a reference into a bare repo.
    let parts = ref.split('/');
    let idx = parse.indexOf( p => p.endsWith('.git') );
    if( idx > -1 ) {
        repoPath = parts.slice( 0, idx ).join('/');
        if( await Git.isBare( repoPath ) ) {
            filePath = parts.slice( idx ).join('/');
            return new Source( repoPath, filePath );
        }
    }
    // Check for a reference into a non-bare repo.
    let repoPath = await Git.getRoot( ref );
    if( repoPath ) {
        filePath = Path.relative( ref, repoPath );
        return new Source( repoPath, filePath );
    }
    // No git repo detected, treat as plain file path.
    filePath = ref;
    return new Source( null, filePath );
}

exports.Source = Source;

