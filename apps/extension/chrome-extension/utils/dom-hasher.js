// utils/dom-hasher.js
// Context Retriever V5: Semantic Anchor Strategy & Heuristic Engine

window.HireMaxHasher = {
    // Top-level entry
    calculate: async function () {
        const fields = [];
        const inputs = this.deepQuerySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');

        for (let i = 0; i < inputs.length; i++) {
            const el = inputs[i];
            if (this.isElementVisible(el)) {
                fields.push(await this.extractSemanticContext(el, i));
            }
        }

        const structureString = fields.map(f => `${f.tag}:${f.name}:${f.semantic_label}`).join('|');
        const hash = this.simpleHash(structureString);

        return {
            hash,
            fields,
            page_context: {
                url: window.location.href,
                title: document.title,
                text_content: document.body.innerText.slice(0, 1500)
            }
        };
    },

    extractSemanticContext: async function (el, index) {
        // Core Attributes
        const tag = el.tagName.toLowerCase();
        const type = el.type || 'text';
        const name = el.name || '';
        const id = el.id || '';
        const placeholder = el.placeholder || '';
        const isRequired = el.required || el.getAttribute('aria-required') === 'true' || false;

        // Semantic Anchor Strategy
        const ariaLabel = el.getAttribute('aria-label') || '';
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        let ariaLabelledByText = '';
        if (ariaLabelledBy) {
            const labelEl = document.getElementById(ariaLabelledBy);
            // check shadow dom if not found globally
            if (!labelEl) {
                const rootNode = el.getRootNode();
                if (rootNode instanceof ShadowRoot) {
                    const shadowLabelEl = rootNode.getElementById(ariaLabelledBy);
                    if (shadowLabelEl) ariaLabelledByText = shadowLabelEl.innerText.trim();
                }
            } else {
                ariaLabelledByText = labelEl.innerText.trim();
            }
        }

        const explicitLabel = this.findExplicitLabel(el);
        const geometryLabel = this.findProximityLabel(el);
        const wrapperLabel = this.findWrapperLabel(el);

        // Data Attributes Preference
        const dataAttributes = {};
        for (const attr of el.attributes) {
            if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
                dataAttributes[attr.name] = attr.value;
            }
        }

        // Determine best semantic label
        const semantic_label = explicitLabel || ariaLabel || ariaLabelledByText || wrapperLabel || geometryLabel || placeholder || name;

        return {
            index,
            tag,
            type,
            name,
            id,
            placeholder,
            semantic_label: semantic_label.substring(0, 100).trim(),
            explicit_label: explicitLabel,
            proximity_label: geometryLabel,
            value: el.value || '',
            is_required: isRequired,
            data_attributes: dataAttributes,
            selector: this.getStableSelector(el),
            is_shadow: !!this.getShadowHost(el),
            geometry: el.getBoundingClientRect().toJSON()
        };
    },

    findExplicitLabel: function (el) {
        if (!el.id) return "";
        const root = el.getRootNode();
        let labels = Array.from(root.querySelectorAll(`label[for="${el.id}"]`));
        if (labels.length > 0 && labels[0].innerText) return labels[0].innerText.trim();
        return "";
    },

    findWrapperLabel: function (el) {
        let parent = el.parentElement;
        let depth = 0;
        while (parent && parent !== document.body && parent !== null && depth < 3) {
            if (parent.tagName === 'LABEL' && parent.innerText) {
                // remove the input text itself to get just the label part
                let clone = parent.cloneNode(true);
                let inputs = clone.querySelectorAll('input, select, textarea');
                inputs.forEach(i => i.remove());
                return clone.innerText.trim();
            }
            parent = parent.parentElement;
            depth++;
        }
        return "";
    },

    findProximityLabel: function (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return "";

        const root = el.getRootNode();
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                    const parentTag = node.parentElement?.tagName;
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let bestText = "";
        let minDistance = 500; // max px distance to consider

        let node = walker.nextNode();
        while (node) {
            const parent = node.parentElement;
            if (parent && parent !== el) {
                const pRect = parent.getBoundingClientRect();
                // Check if text is above or to the left of the input
                const isAbove = pRect.bottom <= rect.top + 10 && pRect.bottom > rect.top - 100;
                const isLeft = pRect.right <= rect.left + 10 && pRect.right > rect.left - 200 && Math.abs(pRect.top - rect.top) < 30;

                if (isAbove || isLeft) {
                    const distance = isAbove ? Math.abs(rect.top - pRect.bottom) : Math.abs(rect.left - pRect.right);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestText = node.textContent.trim();
                    }
                }
            }
            node = walker.nextNode();
        }
        return bestText;
    },

    getStableSelector: function (el) {
        // Priority 1: ID (if it doesn't look auto-generated like a random hash or number)
        if (el.id && !/\d{4,}/.test(el.id) && !/^uuid/.test(el.id)) {
            return `#${el.id}`;
        }

        // Priority 2: Data Testing attributes (common in modern ATS like Greenhouse/Lever)
        const testAttrs = ['data-test-id', 'data-qa', 'data-automation-id', 'data-testid', 'name'];
        for (const attr of testAttrs) {
            const val = el.getAttribute(attr);
            if (val && !/\d{4,}/.test(val)) {
                return `${el.tagName.toLowerCase()}[${attr}="${val}"]`;
            }
        }

        // Fallback: We don't use nth-child for execution anymore!
        // We will rely on Semantic Matching during execution.
        // We store this selector merely as an absolute worst-case fallback,
        // but our engine will match based on 'semantic_label' primarily.

        let path = [];
        let current = el;
        while (current && current !== document.documentElement && current !== null) {
            let selector = current.tagName.toLowerCase();

            // Try to find a stable class or attribute on the parent
            if (current.id && !/\d{4,}/.test(current.id)) {
                path.unshift(`#${current.id}`);
                break;
            }

            if (current.hasAttribute('data-automation-id')) {
                path.unshift(`${selector}[data-automation-id="${current.getAttribute('data-automation-id')}"]`);
                break;
            }

            let parent = current.parentNode;
            if (parent && parent.children) {
                let index = Array.from(parent.children).indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
            path.unshift(selector);

            const root = current.getRootNode();
            current = (root instanceof ShadowRoot) ? root.host : current.parentNode;
        }
        return path.join(" > ");
    },

    deepQuerySelectorAll: function (selector, root = document) {
        let nodes = Array.from(root.querySelectorAll(selector));
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        let currentNode = walker.nextNode();
        while (currentNode) {
            if (currentNode.shadowRoot) {
                nodes = nodes.concat(this.deepQuerySelectorAll(selector, currentNode.shadowRoot));
            }
            currentNode = walker.nextNode();
        }
        return nodes;
    },

    getShadowHost: function (el) {
        let root = el.getRootNode();
        return root instanceof ShadowRoot ? root.host : null;
    },

    isElementVisible: function (el) {
        if (!el.getClientRects().length) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

        let parent = el.parentElement;
        while (parent && parent !== document.body && parent !== null) {
            const pStyle = window.getComputedStyle(parent);
            if (pStyle.display === 'none') return false;
            parent = parent.parentElement;
        }
        return true;
    },

    simpleHash: function (str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(16);
    }
};
