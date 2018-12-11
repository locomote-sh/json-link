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

const { Source } = require('./source');

/**
 * Load a JSON file from a path.
 * @param ref       A reference to the JSON file to laod. Can be specified
 *                  as a string path or a Source instance. File paths can
 *                  reference plain files on the filesystem or files within
 *                  a repository managed by git. Files can be referenced
 *                  within both bare and non-bare (e.g. cloned) repositories.
 *                  If the referenced file is within a repo then git is used
 *                  to access the file's contents, and specific versions of
 *                  the file can be referened by appending # followed by
 *                  a commit-ish to the end of the file path.
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
async function loadJSON( ref, env = process.env, required = true ) {
    try {
        // Read the file.
        const source = await Source.parseSource( ref );
        const json = await source.read();
        const data = JSON.parse( json );
        return resolve( data, source, env );
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
 * @param source    The source file containing the value being resolved.
 * @param env       Variables used to resolve path templates.
 * @returns The resolve property value.
 */
async function resolve( value, source, env ) {
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
            // Resolve the path relative to the current source.
            let _source = source.resolve( path );
            // Load the referenced data.
            value = await loadJSON( _source, env, required );
        }
        break;
    case 'object':
        // Resolve each item in the array or each property of object.
        if( Array.isArray( value ) ) {
            value = Promise.all( value.map( i => resolve( i, source, env ) ) );
        }
        else for( let name in value ) {
            value[name] = await resolve( value[name], source, env );
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
