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

const FS = require('fs');
const Path = require('path');
const spawn = require('child_process').spawn;

class Source {

    constructor( scheme, path, fragment ) {
        this.scheme = scheme;
        this.path = path;
        this.fragment = fragment;
    }

    resolve( ref ) {
        // Return this source if path is absolute.
        if( this.path[0] == '/' ) {
            return this;
        }
        // If this and reference source share the same scheme then resolve this
        // source against the reference.
        if( this.scheme == ref.scheme ) {
            let path = Path.resolve( ref.path, this.path );
            return new Source( this.scheme, path, this.fragment );
        }
        // If this source is a file reference then resolve against current working dir.
        if( this.scheme == 'file:' ) {
            let path = Path.resolve( this.path );
            return new Source( this.scheme, path, this.fragment );
        }
        // Error - can't resolve relative source.
        throw new Error(`Can't resolve ${this.scheme} source against ${ref.scheme} reference`);
    }
}

Source.parseSource = function( source ) {
    if( source instanceof Source ) {
        return source;
    }
    let r = /^(\w+:)?([^#]+)(#.*)?$/.exec( source );
    if( !r ) {
        throw new Error(`Invalid source: ${source}`);
    }
    let [ , scheme, path, fragment ] = r;
    return new Source( scheme, path, fragment );
}

/**
 * Read a file's contents.
 */
function readFile( path ) {
    let wd, commitish;
    // Check for a hash in the path, indicating the presence of a commit-ish
    // identifier at the end of the path.
    let idx = path.indexOf('#');
    if( idx > -1 ) {
        commitish = path.substring( i + 1 );
        path = path.substring( 0, i );
    }
    // Check for a path into a bare repo; a dir name ending with .git is
    // used to identify a bare repo.
    let components = path.split('/');
    let idx = components.findIndex( c => c.endsWith('.git') );
    if( idx > -1 ) {
        // Path references a file within a bare repo; set the working directory
        // to the bare repo path, and the file path as the portion of the path
        // relative to the bare repo dir.
        wd = path.slice( 0, i ).join('/');
        path = path.slice( i ).join('/');
    }
    else if( commitish ) {
        // Path doesn't reference a bare repo but does contain a commit-ish, so
        // set the working directory to the target file's parent dir and the
        // path to just the filename.
        wd = Path.dirname( path );
        path = Path.filename( path );
    }
    // If we have a working directory at this point then the file contents should
    // be loaded via git.
    if( wd ) {
        // Default the commit-ish to the master branch.
        commitish = commitish || 'master';
        return new Promise( ( resolve, reject ) => {
            let proc = spawn('git', ['show', `${commitish}:${path}`], { wd });
            let stdout = '';
            proc.stdout.on('data', data => stdout += data.toString() );
            proc.on('close', code  => resolve( stdout ) );
            proc.on('error', reject );
        });
    }
    // Load file from file system.
    return new Promise( ( resolve, reject ) => {
        FS.readFile( path, ( err, data ) => {
            if( err ) {
                return reject( err );
            }
            resolve( data.toString() );
        });
    });
}

/**
 * Load a JSON file from a path.
 * @param path      The path of the file to load.
 * @param env       Variables used to resolve path templates.
 * @param required  If true then an error will be throw if the referenced
 *                  JSON file isn't found or doesn't contain valid JSON.
 *                  If false then no error will be thrown if the referenced
 *                  JSON file isn't found and null will be returned; but an
 *                  error will be raised if the file is found but doesn't
 *                  contain valid JSON.
 * @returns The parsed contents of the file, with any nested file references
 * resolved and loaded.
 */
async function loadJSON( path, env = process.env, required = true ) {
    try {
        // Read the file.
        const dirname = Path.dirname( path );
        const json = await readFile( path );
        const data = JSON.parse( json );
        return resolve( data, dirname, env );
    }
    catch( e ) {
        // If file not found and not required then return null.
        if( e.code == 'ENOENT' && !required ) {
            return null;
        }
        throw e;
    }
}

/**
 * Resolve a property value to its actual value.
 * A string property can reference the JSON contents of a file by using
 * the file path with a '@' prefix. Relative paths are resolved against
 * the path of the file containing the reference.
 * @param value     The value to resolve.
 * @param dirname   The directory path of the file containing the value.
 * @param env       Variables used to resolve path templates.
 * @returns The resolve property value.
 */
async function resolve( value, dirname, env ) {
    switch( typeof value ) {
    case 'string':
        // Check for a link.
        if( value[0] == '@' ) {
            // Extract the file path and replace variable refs.
            let path = value.substring( 1 );
            path = replace( path, env );
            // Check for an required path.
            let required = false;
            if( path[0] == '!' ) {
                path = path.substring( 1 );
                required = true;
            }
            // Resolve the path and load data.
            path = Path.resolve( dirname, value.substring( 1 ) );
            value = await loadJSON( path, env, required );
        }
        break;
    case 'object':
        // Resolve each item in the array or each property of object.
        if( Array.isArray( value ) ) {
            value = Promise.all( value.map( i => resolve( i, dirname, env ) ) );
        }
        else for( let name in value ) {
            value[name] = await resolve( value[name], dirname, env );
        }
        break;
    default:
        // Return value as-is.
        break;
    }
    return value;
}

/**
 * Replace environment variable references in a string.
 * @param str   A string with variable references in ${name} format.
 * @param env   An object containing environment name/value pairs.
 * @returns The string with all variable references replaced by their corresponding
 * value in the environment.
 */
function replace( str, env ) {
    let result = '';
    while( true ) {
        let r = /^(.*)\$\{(\w+)\}(.*)$/.exec( str );
        if( r ) {
            let [ , leading, name, trailing ] = r;
            result += leading;
            result += env[name] || '';
            str = trailing;
        }
        else {
            result += str;
            break;
        }
    }
    return result;
}

exports.loadJSON = loadJSON;
