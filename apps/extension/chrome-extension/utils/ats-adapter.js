// utils/ats-adapter.js
// HireMax ATS Adapter Layer V1
// Detects major ATS platforms and provides optimized selectors + field hints.
// Reduces AI calls and greatly improves first-fill accuracy.

window.HireMaxATS = {

    // --- PLATFORM FINGERPRINTS ---
    PLATFORMS: {
        GREENHOUSE: {
            name: 'Greenhouse',
            detect: (url, scripts, dom) => {
                return url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')
                    || !!dom.querySelector('[data-gh-field]')
                    || !!dom.querySelector('form#application_form')
                    || scripts.some(s => s.includes('greenhouse'));
            },
            selectors: {
                first_name: '#first_name',
                last_name: '#last_name',
                email: '#email',
                phone: '#phone',
                linkedin_url: '#job_application_answers_attributes_0_text_value, input[name*="linkedin"]',
                cover_letter: '#cover_letter_text',
            },
            submit_selector: '#submit_app',
            next_selector: null, // single page
        },

        LEVER: {
            name: 'Lever',
            detect: (url, scripts, dom) => {
                return url.includes('lever.co') || url.includes('jobs.lever.co')
                    || scripts.some(s => s.includes('lever'));
            },
            selectors: {
                full_name: '#name',
                email: '#email',
                phone: '#phone',
                linkedin_url: '#urls_LinkedIn',
                portfolio_url: '#urls_Portfolio',
                resume: 'input[type="file"]',
            },
            submit_selector: '.application-submit button[type="submit"]',
            next_selector: null,
        },

        WORKDAY: {
            name: 'Workday',
            detect: (url, scripts, dom) => {
                return url.includes('myworkdayjobs.com') || url.includes('workday.com')
                    || !!dom.querySelector('[data-automation-id]')
                    || scripts.some(s => s.includes('workday'));
            },
            selectors: {
                // Workday uses data-automation-id heavily
                first_name: '[data-automation-id="firstName"]',
                last_name: '[data-automation-id="lastName"]',
                email: '[data-automation-id="email"]',
                phone: '[data-automation-id="phone"]',
                LinkedIn: '[data-automation-id="linkedInUrl"]',
                resume: '[data-automation-id="file-upload-input"], input[type="file"]',
                cover_letter: '[data-automation-id="coverLetter"]',
            },
            submit_selector: '[data-automation-id="bottom-navigation-next-button"]',
            next_selector: '[data-automation-id="bottom-navigation-next-button"]',
            is_multi_step: true,
        },

        ASHBY: {
            name: 'Ashby',
            detect: (url, scripts, dom) => {
                return url.includes('ashbyinc.com') || url.includes('jobs.ashbyhq.com')
                    || scripts.some(s => s.includes('ashby'));
            },
            selectors: {
                resume: 'input[type="file"]',
            },
            submit_selector: 'button[type="submit"]',
            next_selector: 'button[data-testid="next"]',
            is_multi_step: true,
        },

        SMARTRECRUITERS: {
            name: 'SmartRecruiters',
            detect: (url, scripts, dom) => {
                return url.includes('smartrecruiters.com')
                    || !!dom.querySelector('[data-smarttoken]')
                    || scripts.some(s => s.includes('smartrecruiters'));
            },
            selectors: {
                first_name: 'input[name="firstName"]',
                last_name: 'input[name="lastName"]',
                email: 'input[name="email"]',
                phone: 'input[name="phoneNumber"]',
                resume: 'input[type="file"]',
            },
            submit_selector: 'button[type="submit"]',
            next_selector: 'button.smart-apply__next-button',
            is_multi_step: true,
        },

        BAMBOOHR: {
            name: 'BambooHR',
            detect: (url, scripts, dom) => {
                return url.includes('bamboohr.com') || scripts.some(s => s.includes('bamboohr'));
            },
            selectors: {
                first_name: '#first_name',
                last_name: '#last_name',
                email: '#email',
                phone: '#phone',
                resume: '#resume_file, input[type="file"]',
            },
            submit_selector: '#submit',
            next_selector: null,
        },

        ICIMS: {
            name: 'iCIMS',
            detect: (url, scripts, dom) => {
                return url.includes('icims.com') || scripts.some(s => s.includes('icims'));
            },
            selectors: {
                resume: 'input[type="file"]',
            },
            submit_selector: 'button[type="submit"]',
            next_selector: '.icims-button-next',
            is_multi_step: true,
        },

        JOBVITE: {
            name: 'Jobvite',
            detect: (url, scripts, dom) => {
                return url.includes('jobvite.com') || scripts.some(s => s.includes('jobvite'));
            },
            selectors: {
                first_name: 'input[name="jv-fname"]',
                last_name: 'input[name="jv-lname"]',
                email: 'input[name="jv-email"]',
                phone: 'input[name="jv-phone"]',
                resume: 'input[type="file"]',
            },
            submit_selector: '.jv-apply-submit-btn',
            next_selector: '.jv-apply-next-btn',
            is_multi_step: true,
        },
    },

    /**
     * Detect which ATS platform is currently active.
     * @returns { platformKey, adapter } or null
     */
    detect: function () {
        const url = window.location.href;
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        const dom = document;

        for (const [key, adapter] of Object.entries(this.PLATFORMS)) {
            try {
                if (adapter.detect(url, scripts, dom)) {
                    console.log(`[HireMax ATS] Platform detected: ${adapter.name}`);
                    return { platformKey: key, adapter };
                }
            } catch (e) {
                // Detection should never break
            }
        }
        console.log('[HireMax ATS] No known platform detected. Universal mode active.');
        return null;
    },

    /**
     * Get an optimized selector for a specific field intent on the current platform.
     */
    getSelector: function (platformAdapter, intent) {
        if (!platformAdapter) return null;
        return platformAdapter.adapter.selectors?.[intent] ?? null;
    },

    /**
     * Find the next step / continue button on the current page.
     */
    findNextButton: function (platformAdapter) {
        const Hasher = window.HireMaxHasher;
        const selectors = [
            platformAdapter?.adapter?.next_selector,
            'button[aria-label*="next" i]',
            'button[aria-label*="continue" i]',
            'a[aria-label*="next" i]',
        ].filter(Boolean);

        // Also look for buttons by text content
        const textPatterns = [/^next$/i, /^continue$/i, /^save\s*and\s*continue$/i, /^proceed$/i, /^advance$/i];

        for (const sel of selectors) {
            const el = Hasher.deepQuerySelectorAll(sel).find(e => e.offsetParent !== null);
            if (el) return el;
        }

        // Text-based fallback
        const allButtons = Hasher.deepQuerySelectorAll('button, [role="button"], a.btn, input[type="button"]');
        for (const btn of allButtons) {
            const text = btn.innerText?.trim() || btn.value || '';
            if (textPatterns.some(p => p.test(text)) && btn.offsetParent !== null) {
                return btn;
            }
        }
        return null;
    },

    /**
     * Find the submit button on the current page.
     */
    findSubmitButton: function (platformAdapter) {
        const Hasher = window.HireMaxHasher;
        const sel = platformAdapter?.adapter?.submit_selector;
        if (sel) {
            const el = Hasher.deepQuerySelectorAll(sel).find(e => e.offsetParent !== null);
            if (el) return el;
        }

        // Generic fallbacks
        const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button.submit', 'button.apply'];
        for (const s of submitSelectors) {
            const el = Hasher.deepQuerySelectorAll(s).find(e => e.offsetParent !== null);
            if (el) return el;
        }
        return null;
    }
};
