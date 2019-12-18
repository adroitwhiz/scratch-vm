const Scratch = window.Scratch = window.Scratch || {};

const VirtualMachine = require('..');
const Blockly = require('scratch-blocks');

const logElem = document.getElementById('log');
const addLogEntry = (message, type) => {
    const logEntry = document.createElement('div');
    logEntry.appendChild(document.createTextNode(message));
    logEntry.classList.add('log-entry', type);
    logElem.appendChild(logEntry);
};

const log = {
    info: message => {
        addLogEntry(message, 'info');
    },
    warn: message => {
        addLogEntry(message, 'warn');
    },
    error: message => {
        addLogEntry(message, 'error');
    }
};

const saveJsonFile = (text, filename) => {
    const blob = new Blob([text], {type: 'application/json'});
    const a = document.createElement('a');
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.click();
};

const exportSpecmap = () => {
    const allCategories = [];

    // "Core" categories
    const toolbox = Scratch.workspace.getToolbox();
    for (let i = 0; i <= 6; i++) {
        allCategories.push(toolbox.getCategoryByIndex(i).getContents());
    }

    // Data category
    allCategories.push(Blockly.DataCategory(Scratch.workspace));

    // Extension categories
    Array.prototype.push.apply(allCategories,
        Scratch.vm.runtime.getBlocksXML().map(cat => Array.from(
            // parse each category's XML, then get the <category> element's children
            (new DOMParser()).parseFromString(cat.xml, 'text/xml').children[0].children)
        )
    );

    const allBlocks = allCategories.flat();

    const specMap = {};
    for (const block of allBlocks) {
        const values = {};

        // Shadowed inputs
        for (const child of block.children) {
            if (child.tagName === 'value') {
                const shadow = Array.prototype.find.call(child.children, valChild => valChild.tagName === 'shadow');
                values[child.getAttribute('name')] = shadow.getAttribute('type');
            }
        }

        try {
            const createdBlock = Scratch.workspace.newBlock(block.getAttribute('type'));

            const inputValues = createdBlock.inputList;
            // Non-shadowed inputs
            for (const input of inputValues) {
                if (!values.hasOwnProperty(input.name) && input.name) {
                    switch (input.type) {
                    // Blockly.INPUT_VALUE
                    // we're assuming it's a boolean because all other input types are shadowed
                    case 1: {
                        values[input.name] = 'boolean';
                        break;
                    }
                    // Blockly.NEXT_STATEMENT
                    case 3: {
                        values[input.name] = 'substack';
                        break;
                    }
                    // Blockly.DUMMY_INPUT
                    case 5: {
                        break;
                    }
                    default: {
                        log.error(`Unknown input type ${input.type} in block ${block.getAttribute('type')}`);
                    }
                    }

                    /* eslint-disable-next-line max-len */
                    log.info(`specmap for ${block.getAttribute('type')} didn't have shadowed value ${input.name}; added as ${values[input.name]}`);
                }

                // Add fields

                // const fieldTypeMap = Blockly.Field.TYPE_MAP_;
                for (const field of input.fieldRow) {
                    if (!field.name) continue;
                    /* let fieldType = null;
                    for (const potentialFieldType in fieldTypeMap) {
                        if (
                            fieldTypeMap.hasOwnProperty(potentialFieldType) &&
                            field instanceof fieldTypeMap[potentialFieldType]
                        ) {
                            fieldType = potentialFieldType;
                            break;
                        }
                    }

                    if (!fieldType) log.warn(`Unknown field type ${field.type}`); */

                    values[field.name] = 'field';
                }
            }
        } catch (err) {
            log.warn(`could not add non-shadowed inputs on ${block.getAttribute('type')}`, err);
        }

        const blockType = block.getAttribute('type');
        const blockID = block.getAttribute('id');

        specMap[blockType || blockID] = values;
    }

    saveJsonFile(JSON.stringify(specMap, null, '\t'), 'specmap-sb3.json');
};

window.onload = function () {
    // Lots of global variables to make debugging easier
    // Instantiate the VM.
    const vm = new VirtualMachine();
    Scratch.vm = vm;

    // Instantiate scratch-blocks and attach it to the DOM.
    const workspace = Blockly.inject('blocks', {
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.75
        },
        colours: {
            workspace: '#334771',
            flyout: '#283856',
            scrollbar: '#24324D',
            scrollbarHover: '#0C111A',
            insertionMarker: '#FFFFFF',
            insertionMarkerOpacity: 0.3,
            fieldShadow: 'rgba(255, 255, 255, 0.3)',
            dragShadowOpacity: 0.6
        }
    });
    Scratch.workspace = workspace;

    window.Blockly = Blockly;

    Scratch.workspace.createVariable('VAR_NAME', '', 'VAR_ID');
    Scratch.workspace.createVariable('LIST_NAME', 'list', 'LIST_ID');

    Scratch.vm.extensionManager.loadExtensionURL('pen')
        .then(() => {
            Scratch.vm.extensionManager.loadExtensionURL('music');
        })
        .then(() => {
            exportSpecmap();
        })
        .catch(log.error);
};
