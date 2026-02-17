// tests/simulate_dom_hash.ts
// Run with: deno run --allow-read tests/simulate_dom_hash.ts

console.log("--- SIMULATION: DOM STRUCTURAL HASHING ---");

// 1. MOCK DOM ENVIRONMENT
// We need a minimal mock of document, TreeWalker, and Node
const NodeFilter = {
    SHOW_ELEMENT: 1,
    FILTER_ACCEPT: 1,
    FILTER_SKIP: 3
};

class MockNode {
    constructor(tagName, id, name, type, children = []) {
        this.tagName = tagName;
        this.id = id;
        this.name = name;
        this.type = type;
        this.children = children;
    }
}

// Mocking the TreeWalker is tricky without a real DOM, 
// so let's mock the "algo" directly by adapting the logic to our MockNode tree.
function calculateHash(rootNode) {
    const relevantTags = ['FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL'];
    let structureString = "";

    function traverse(node) {
        if (relevantTags.includes(node.tagName)) {
            structureString += node.tagName;
            if (node.id && node.id.length < 20 && !/\d/.test(node.id)) {
                structureString += `#${node.id}`;
            }
            if (node.name) {
                structureString += `[name=${node.name}]`;
            }
            if (node.type) {
                structureString += `[type=${node.type}]`;
            }
            structureString += "|";
        }
        for (const child of node.children) {
            traverse(child);
        }
    }

    traverse(rootNode);
    return simpleSha256(structureString);
}


function simpleSha256(ascii) {
    // Simple hash for simulation (djb2ish)
    let hash = 5381;
    for (let i = 0; i < ascii.length; i++) {
        hash = ((hash << 5) + hash) + ascii.charCodeAt(i);
    }
    return hash.toString(16);
}

// 2. DEFINE SCENARIOS

// Case A: Standard Form
const formA = new MockNode("FORM", "apply-form", null, null, [
    new MockNode("DIV", "container-1", null, null, [ // Divs should be ignored
        new MockNode("LABEL", null, null, null),
        new MockNode("INPUT", "first_name", "firstName", "text")
    ]),
    new MockNode("DIV", "container-2", null, null, [
        new MockNode("LABEL", null, null, null),
        new MockNode("INPUT", "last_name", "lastName", "text")
    ]),
    new MockNode("BUTTON", "submit-btn", null, "submit")
]);

// Case B: "Noisy" Form (Class changes, extra divs, chaos)
// Structure (Inputs/Labels) is IDENTICAL. 
const formB = new MockNode("FORM", "apply-form", null, null, [
    new MockNode("DIV", "new-wrapper-class", null, null, [
        new MockNode("SPAN", null, null, null, [ // Extra span
            new MockNode("LABEL", null, null, null)
        ]), // Wrapper changed
        new MockNode("INPUT", "first_name", "firstName", "text")
    ]),
    new MockNode("SECTION", "container-2", null, null, [ // Div -> Section
        new MockNode("LABEL", null, null, null),
        new MockNode("INPUT", "last_name", "lastName", "text")
    ]),
    new MockNode("BUTTON", "submit-btn", null, "submit")
]);

// Case C: Structural Change (Added Field)
const formC = new MockNode("FORM", "apply-form", null, null, [
    new MockNode("DIV", "container-1", null, null, [
        new MockNode("LABEL", null, null, null),
        new MockNode("INPUT", "first_name", "firstName", "text")
    ]),
    new MockNode("DIV", "container-2", null, null, [
        new MockNode("LABEL", null, null, null),
        new MockNode("INPUT", "last_name", "lastName", "text"),
        new MockNode("INPUT", "middle_name", "middleName", "text") // NEW FIELD
    ]),
    new MockNode("BUTTON", "submit-btn", null, "submit")
]);

// 3. EXECUTE & ASSERT
const hashA = calculateHash(formA);
const hashB = calculateHash(formB);
const hashC = calculateHash(formC);

console.log(`Hash A (Standard): ${hashA}`);
console.log(`Hash B (Noisy):    ${hashB}`);
console.log(`Hash C (Changed):  ${hashC}`);

if (hashA === hashB) {
    console.log("✅ SUCCESS: Hash is resilient to container/attribute noise.");
} else {
    console.error("❌ FAILURE: Hash changed due to noise.");
}

if (hashA !== hashC) {
    console.log("✅ SUCCESS: Hash detected structural change.");
} else {
    console.error("❌ FAILURE: Hash did not detect structural change.");
}
