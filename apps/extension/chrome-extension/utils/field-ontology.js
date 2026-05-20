// utils/field-ontology.js
// HireMax Local Field Ontology V1
// Deterministic zero-latency classification. AI is only a fallback for ambiguous fields.

window.HireMaxOntology = {

    // --- FIELD TAXONOMY ---
    // Each entry: { intent, keywords[], confidence }
    // Keywords are matched against: label, placeholder, name, aria-label, surrounding text
    TAXONOMY: [
        // Identity
        { intent: 'first_name', patterns: [/first[\s_-]?name/i, /given[\s_-]?name/i, /^fname$/i, /^first$/i] },
        { intent: 'last_name', patterns: [/last[\s_-]?name/i, /family[\s_-]?name/i, /surname/i, /^lname$/i, /^last$/i] },
        { intent: 'full_name', patterns: [/full[\s_-]?name/i, /your[\s_-]?name/i, /^name$/i, /legal[\s_-]?name/i] },
        { intent: 'email', patterns: [/e[\s_-]?mail/i, /electronic[\s_-]?mail/i, /contact[\s_-]?email/i] },
        { intent: 'phone', patterns: [/phone/i, /mobile/i, /cell/i, /telephone/i, /contact[\s_-]?number/i] },

        // Location
        { intent: 'location', patterns: [/^location$/i, /city[,\s]/i, /current[\s_-]?location/i, /where[\s_-]?(do\s)?you[\s_-]?live/i] },
        { intent: 'city', patterns: [/^city$/i, /\bcity\b/i] },
        { intent: 'state', patterns: [/^state$/i, /province/i, /\bstate\b/i] },
        { intent: 'zip_code', patterns: [/zip/i, /postal[\s_-]?code/i, /postcode/i] },
        { intent: 'country', patterns: [/^country$/i, /\bcountry\b/i, /nation/i] },
        { intent: 'address', patterns: [/address/i, /street/i] },

        // Professional Identity
        { intent: 'linkedin_url', patterns: [/linkedin/i] },
        { intent: 'portfolio_url', patterns: [/portfolio/i, /personal[\s_-]?site/i, /website/i, /github/i, /personal[\s_-]?url/i] },
        { intent: 'resume', patterns: [/resume/i, /cv\b/i, /curriculum[\s_-]?vitae/i, /upload[\s_-]?file/i] },
        { intent: 'cover_letter', patterns: [/cover[\s_-]?letter/i, /letter[\s_-]?of[\s_-]?interest/i] },

        // Work Status
        { intent: 'work_authorization', patterns: [/work[\s_-]?(eligibility|authorization|status|permit|rights|visa)/i, /authorized[\s_-]?to[\s_-]?work/i, /legally[\s_-]?(authorized|eligible)/i, /right[\s_-]?to[\s_-]?work/i] },
        { intent: 'visa_sponsorship', patterns: [/visa[\s_-]?sponsor/i, /require[\s_-]?sponsor/i, /need[\s_-]?sponsor/i, /sponsorship[\s_-]?required/i] },
        { intent: 'start_date', patterns: [/start[\s_-]?date/i, /available[\s_-]?(from|date|when)/i, /when[\s_-]?can[\s_-]?you[\s_-]?start/i, /earliest[\s_-]?start/i] },
        { intent: 'notice_period', patterns: [/notice[\s_-]?period/i, /two[\s\W]?weeks/i, /current[\s_-]?notice/i] },

        // Compensation
        { intent: 'salary_expectation', patterns: [/salary[\s_-]?(expect|requirement|desired|request)/i, /expected[\s_-]?salary/i, /desired[\s_-]?(pay|comp)/i, /compensation[\s_-]?expect/i, /what[\s_-]?are[\s_-]?you[\s_-]?looking[\s_-]?for/i] },

        // Demographics (EEO)
        { intent: 'gender', patterns: [/\bgender\b/i, /\bsex\b/i] },
        { intent: 'ethnicity', patterns: [/ethnicity/i, /racial/i, /race[\s_-]?(and|\/)?ethnicity/i] },
        { intent: 'disability', patterns: [/disability/i, /disabled/i, /accommodation/i] },
        { intent: 'veteran_status', patterns: [/veteran/i, /military[\s_-]?status/i, /armed[\s_-]?forces/i] },

        // Additional
        { intent: 'languages', patterns: [/language[s]?/i] },
        { intent: 'education_level', patterns: [/degree/i, /education[\s_-]?level/i, /highest[\s_-]?education/i] },
        { intent: 'years_experience', patterns: [/years[\s_-]?of[\s_-]?exp/i, /how[\s_-]?many[\s_-]?years/i, /experience[\s_-]?level/i] },
        { intent: 'referral', patterns: [/referred[\s_-]?by/i, /referral/i, /how[\s_-]?did[\s_-]?you[\s_-]?hear/i, /source[\s_-]?of[\s_-]?referral/i] },
        { intent: 'willing_to_relocate', patterns: [/relocat/i, /willing[\s_-]?to[\s_-]?move/i] },
        { intent: 'remote_preference', patterns: [/remote[\s_-]?preference/i, /work[\s_-]?from[\s_-]?home/i, /hybrid/i] },
    ],

    /**
     * Classify a field object (from dom-hasher) against the ontology.
     * Returns { intent, confidence } or null if ambiguous.
     */
    classify: function (field) {
        // Build a composite string of all available signal surfaces
        const surfaces = [
            field.semantic_label,
            field.explicit_label,
            field.proximity_label,
            field.placeholder,
            field.name,
            field.id,
            ...(Object.values(field.data_attributes || {}))
        ].filter(Boolean).join(' ').toLowerCase();

        let bestMatch = null;
        let bestScore = 0;

        for (const entry of this.TAXONOMY) {
            let score = 0;
            for (const pattern of entry.patterns) {
                if (pattern.test(surfaces)) {
                    score++;
                    break; // one match per entry is sufficient
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = entry.intent;
            }
        }

        // File input heuristic: any file input is likely a resume unless context says otherwise
        if (field.type === 'file' && !bestMatch) {
            return { intent: 'resume', confidence: 0.85 };
        }

        if (bestMatch && bestScore > 0) {
            return { intent: bestMatch, confidence: 0.95 };
        }

        // For textarea, if no match found, it's a custom question
        if (field.tag === 'textarea') {
            return { intent: 'custom_question', confidence: 0.7 };
        }

        return null; // Ambiguous — defer to AI
    },

    /**
     * Map a classified intent to a user profile path.
     * Returns the value from the profile, or null.
     */
    resolveFromProfile: function (intent, profile) {
        if (!profile) return null;
        const data = profile.resume_profiles || {};
        const meta = profile.metadata || {};

        const intentMap = {
            'first_name': profile.full_name?.split(' ')[0] ?? null,
            'last_name': profile.full_name?.split(' ').slice(1).join(' ') ?? null,
            'full_name': profile.full_name ?? null,
            'email': profile.email ?? null,
            'phone': data.phone ?? meta.phone ?? null,
            'location': data.location ?? meta.location ?? null,
            'city': data.city ?? null,
            'state': data.state ?? null,
            'zip_code': data.zip_code ?? null,
            'country': data.country ?? 'United States',
            'address': data.address ?? null,
            'linkedin_url': data.linkedin ?? data.linkedin_url ?? meta.linkedin ?? null,
            'portfolio_url': data.portfolio ?? data.website ?? data.github ?? null,
            'resume': 'RESUME_INJECT_MARKER',
            'cover_letter': data.cover_letter ?? null,
            'work_authorization': data.work_authorization ?? meta.work_authorization ?? null,
            'visa_sponsorship': data.requires_sponsorship ?? meta.requires_sponsorship ?? null,
            'start_date': data.start_date ?? meta.available_from ?? null,
            'notice_period': data.notice_period ?? meta.notice_period ?? null,
            'salary_expectation': data.salary_expectation ?? meta.salary_expectation ?? null,
            'gender': data.gender ?? null,
            'ethnicity': data.ethnicity ?? null,
            'disability': data.disability ?? null,
            'veteran_status': data.veteran_status ?? null,
            'languages': data.languages ?? null,
            'education_level': data.education_level ?? null,
            'years_experience': data.years_experience ?? null,
            'referral': data.referral_source ?? null,
            'willing_to_relocate': data.willing_to_relocate ?? null,
            'remote_preference': data.remote_preference ?? null,
        };

        return intentMap[intent] ?? null;
    }
};
