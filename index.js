const fs = require('fs');
const sass = require('sass');
const path = require('path');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');
const color = require('color');

// it is assumed, that this variable or function name is never used in Sass.
const defaultSafeKeyWord = '__nirvana__';

function getSassContent(filepath) { return fs.readFileSync(filepath, 'utf8'); }

function getSafeKeyword(safeKeyWord) { return typeof safeKeyWord !== 'undefined' ? safeKeyWord : defaultSafeKeyWord; }

function getPostCssConfig(postCssConfig) {
    return {
        ...typeof postCssConfig !== 'undefined' ? postCssConfig : {}
        , ...{ from: undefined , syntax: postcssScss }
    };
}

function findSassVariables(processed) {
    const root = processed.root;
    const sassVariables = [];

    root.walkDecls(/^\$/, decl => { if (decl.parent === root) { sassVariables.push(`'${decl.prop}':${decl.prop}`); } });

    return sassVariables;
}

function getNewSassContent(sassContent, processed, safeKeyWord) {
    return `${sassContent};$${safeKeyWord}:${safeKeyWord}((${findSassVariables(processed).join(',')}));`;
}

function sanitizeKey(key) { return key.replace(/^(["'])(.+)\1$/, '$2'); }

function toJSON(value) {
    if (value instanceof sass.SassMap) {
        const obj = value.contents.toObject();

        return Object.keys(obj).reduce((result, key) => ({
            ...result,
            [sanitizeKey(key)]: toJSON(obj[key])
        }), {});
    }
    if (value instanceof sass.SassList) { return value.asList.toArray().map(item => toJSON(item)); }
    if (value instanceof sass.SassColor) {
        if (value.alpha < 1) { return `rgba(${value.red}, ${value.green}, ${value.blue}, ${value.alpha})`; }

        return color.rgb(value.red, value.green, value.blue).hex().toLowerCase();
    }
    if (value instanceof sass.SassString) { return value.text; }
    if ('value' in value) { return value.value; }

    return undefined;
}

function getSassConfig(filepath, sassConfig, callback, safeKeyWord) {
    return {
        ...typeof sassConfig !== 'undefined' ? sassConfig : {}
        , ...{
            functions: {
                [`${safeKeyWord}($sassVariables)`]: function([sassVariables]) {
                    callback(toJSON(sassVariables));

                    // return anything to not cause an error here.
                    return new sass.SassString('\'\'');
                }
            }
            , loadPaths: [path.dirname(filepath)]
        }
    };
}

function getSassVariablesSync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    const sassContent = getSassContent(filepath);
    const sassVariables = {};
    safeKeyWord = getSafeKeyword(safeKeyWord);

    sass.compileString(
        getNewSassContent(
            sassContent
            // PostCSS process function returns a promise or css for synchronous use.
            , postcss().process(sassContent, getPostCssConfig(postCssConfig)).css
            , safeKeyWord
        )
        , getSassConfig(
            filepath
            , sassConfig
            , sassVariables2 => {
                // very ugly mutation of the variable in the outer scope here. but it is the only simple solution.
                sassVariables = sassVariables2;
            }
            , safeKeyWord
        )
    );

    return sassVariables;
}

function getSassVariablesAsync(filepath, postCssConfig, sassConfig, safeKeyWord) {
    return new Promise(resolve => {
        const sassContent = getSassContent(filepath);
        safeKeyWord = getSafeKeyword(safeKeyWord);

        postcss().process(sassContent, getPostCssConfig(postCssConfig)).then(processed => {
            sass.compileStringAsync(
                getNewSassContent(sassContent, processed, safeKeyWord)
                , getSassConfig(
                    filepath
                    , sassConfig
                    , sassVariables => resolve(sassVariables)
                    , safeKeyWord
                )
            // do nothing!
            ).then(() => {});
        });
    });
}

module.exports = { getSassVariablesAsync, getSassVariablesSync };
