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

/**
 * Read a file's contents.
 */
function readFile( path ) {
    // Check for a hash in the path, indicating the presence of a commit-ish
    // identifier at the end of the path.
    if( path.indexOf('#') > -1 ) {
        // Load the file's contents using git. Note that this assumes that the
        // referenced file path is contained within a non-bare repo, e.g. cloned
        // to the file system.
        let [ name, commitish ] = path.split('#');
        // Use the directory containing the file as the working directory for
        // the git command.
        let wd = Path.dirname( name );
        // Pass just the file name to the git command.
        let file = Path.filename( name );
        return new Promise( ( resolve, reject ) => {
            let proc = spawn('git', ['show', `${commitish}:${file}`], { wd });
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
 * @param optional  If true then no error will be throw if the file fails
 *                  to load, and the function will return null; note
 *                  that an error will still be thrown if the file is found
 *                  but contains invalid JSON.
 * @returns The parsed contents of the file, with any nested file references
 * resolved and loaded.
 */
async function loadJSON( path, env = process.env, optional = false ) {
    const dirname = Path.dirname( path );
    let json;
    try {
        json = await readFile( path );
    }
    catch( e ) {
        if( optional ) {
            return null;
        }
        throw e;
    }
    let data = JSON.parse( json );
    data = await resolve( data, dirname, env );
    return data;
}

/**
 * Resolve a property value to its referenced value.
 * A string property can reference the JSON contents of a file by using
 * the file path with a '@' prefix. Relative paths are resolved against
 * the file path of the file containing the reference.
 * @param value     The value to resolve.
 * @param dirname   The directory path of the file containing the value.
 * @param env       Variables used to resolve path templates.
 * @returns The resolve property value.
 */
async function resolve( value, dirname, env ) {
    switch( typeof value ) {
    case 'string':
        // Check for file reference.
        if( value[0] == '@' ) {
            // Extract the file path and replace variabler refs.
            let path = value.substring( 1 );
            path = replace( path, env );
            // Check for an optional path.
            let optional = false;
            if( path[0] == '?' ) {
                path = value.substring( 1 );
                optional = true;
            }
            // Resolve the path and load data.
            path = Path.resolve( dirname, value.substring( 1 ) );
            value = await loadJSON( path, env, optional );
        }
        break;
    case 'object':
        if( Array.isArray( value ) ) {
            value = Promise.all( value.map( v => resolve( v, dirname, env ) ) );
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
