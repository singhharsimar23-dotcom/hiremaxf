// utils/dom-hasher.js
// Calculates a stable hash of the page structure to identify form types.

window.HireMaxHasher = {
    calculate: function () {
        // We only care about interactive elements and structure
        const relevantTags = ['FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'LABEL'];
        let structureString = "";

        // Depth-first traversal (simplified)
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    return relevantTags.includes(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            }
        );

        while (walker.nextNode()) {
            const node = walker.currentNode;
            structureString += node.tagName;
            if (node.id && node.id.length < 20 && !/\d/.test(node.id)) {
                // Include ID only if it looks stable (short, no numbers)
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

        return this.sha256(structureString);
    },

    sha256: async function (message) {
        // Basic string hashing for prototype (WebCrypto is async, this is a sync simple hash for demo)
        // In prod, use window.crypto.subtle.digest
        let hash = 0, i, chr;
        if (message.length === 0) return hash.toString(16);
        for (i = 0; i < message.length; i++) {
            chr = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(16);
    }
};
