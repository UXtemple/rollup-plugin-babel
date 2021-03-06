import { dirname } from 'path';
import { buildExternalHelpers, transform } from 'babel-core';
import { createFilter } from 'rollup-pluginutils';
import preflightCheck from './preflightCheck.js';
import { assign, warnOnce } from './utils.js';
import { RUNTIME, BUNDLED, HELPERS } from './constants.js';

const keywordHelpers = [ 'typeof', 'extends', 'instanceof' ];

export default function babel ( options ) {
	options = assign( {}, options || {} );
	let inlineHelpers = {};

	const filter = createFilter( options.include, options.exclude );
	delete options.include;
	delete options.exclude;

	if ( options.sourceMap !== false ) options.sourceMaps = true;
	if ( options.sourceMaps !== false ) options.sourceMaps = true;
	delete options.sourceMap;

	const runtimeHelpers = options.runtimeHelpers;
	delete options.runtimeHelpers;

	let externalHelpers;
	if ( options.externalHelpers ) externalHelpers = true;
	delete options.externalHelpers;

	return {
		resolveId ( id ) {
			if ( id === HELPERS ) return id;
		},

		load ( id ) {
			if ( id === HELPERS ) {
				const pattern = new RegExp( `babelHelpers\\.(${keywordHelpers.join('|')})`, 'g' );

				const helpers = buildExternalHelpers( null, 'var' )
					.replace( pattern, 'export var _$1' )
					.replace( /^babelHelpers\./gm, 'export var ' ) +
					`\n\nexport { ${keywordHelpers.map( word => `_${word} as ${word}`).join( ', ')} }`;

				return helpers;
			}
		},

		transform ( code, id ) {
			if ( !filter( id ) ) return null;
			if ( id === HELPERS ) return null;

			const helpers = preflightCheck( options, dirname( id ) );
			const localOpts = assign({ filename: id }, options );

			const transformed = transform( code, localOpts );
			const { usedHelpers } = transformed.metadata;

			if ( usedHelpers.length ) {
				if ( helpers === BUNDLED ) {
					if ( !externalHelpers ) transformed.code += `\n\nimport * as babelHelpers from '${HELPERS}';`;
				} else if ( helpers === RUNTIME && !runtimeHelpers ) {
					throw new Error( 'Runtime helpers are not enabled. Either exclude the transform-runtime Babel plugin or pass the `runtimeHelpers: true` option. See https://github.com/rollup/rollup-plugin-babel#configuring-babel for more information' );
				} else {
					usedHelpers.forEach( helper => {
						if ( inlineHelpers[ helper ] ) {
							warnOnce( `The '${helper}' Babel helper is used more than once in your code. It's strongly recommended that you use the "external-helpers" plugin or the "es2015-rollup" preset. See https://github.com/rollup/rollup-plugin-babel#configuring-babel for more information` );
						}

						inlineHelpers[ helper ] = true;
					});
				}
			}

			return {
				code: transformed.code,
				map: transformed.map
			};
		}
	};
}
