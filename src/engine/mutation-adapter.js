const decodeHtml = require('decode-html');
const log = require('../util/log');

/**
 * Convert a part of a mutation DOM to a mutation VM object, recursively.
 * @param {object} dom DOM object for mutation tag.
 * @return {object} Object representing useful parts of this mutation.
 */
const mutatorTagToObject = function (dom) {
    const obj = Object.create(null);
    obj.tagName = dom.tagName;
    obj.children = [];
    for (const attribute of dom.attributes) {
        const prop = attribute.nodeName;
        if (prop === 'xmlns') continue;
        obj[prop] = decodeHtml(attribute.nodeValue);
        // Note: the capitalization of block info in the following lines is important.
        // The lowercase is read in from xml which normalizes case. The VM uses camel case everywhere else.
        if (prop === 'blockinfo') {
            obj.blockInfo = JSON.parse(obj.blockinfo);
            delete obj.blockinfo;
        }
    }
    for (let i = 0; i < dom.childNodes.length; i++) {
        obj.children.push(
            mutatorTagToObject(dom.childNodes[i])
        );
    }
    return obj;
};

/**
 * Adapter between mutator XML or DOM and block representation which can be
 * used by the Scratch runtime.
 * @param {(object|string)} mutation Mutation XML string or DOM.
 * @return {object} Object representing the mutation.
 */
const mutationAdapter = function (mutation) {
    let mutationParsed;
    // Check if the mutation is already parsed; if not, parse it.
    if (typeof mutation === 'object') {
        mutationParsed = mutation;
    } else {
        log.warn('Mutations from text are deprecated');
        mutationParsed = new DOMParser().parseFromString(mutation, 'text/xml').documentElement;
    }
    return mutatorTagToObject(mutationParsed);
};

module.exports = mutationAdapter;
