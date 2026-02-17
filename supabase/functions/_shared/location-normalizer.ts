export enum USLocation {
    WEST = "US-WEST",
    EAST = "US-EAST",
    CENTRAL = "US-CENTRAL",
    REMOTE = "US-REMOTE",
    OTHER = "US-OTHER",
    REJECTED = "REJECTED"
}

// Full 50-state mapping provided by user
const REGION_MAP: Record<string, USLocation> = {
    // West
    'alaska': USLocation.WEST, 'arizona': USLocation.WEST, 'california': USLocation.WEST,
    'colorado': USLocation.WEST, 'hawaii': USLocation.WEST, 'idaho': USLocation.WEST,
    'montana': USLocation.WEST, 'nevada': USLocation.WEST, 'new mexico': USLocation.WEST,
    'oregon': USLocation.WEST, 'utah': USLocation.WEST, 'washington': USLocation.WEST,
    'wyoming': USLocation.WEST, 'sf': USLocation.WEST, 'seattle': USLocation.WEST,

    // Central
    'alabama': USLocation.CENTRAL, 'arkansas': USLocation.CENTRAL, 'georgia': USLocation.CENTRAL,
    'illinois': USLocation.CENTRAL, 'indiana': USLocation.CENTRAL, 'iowa': USLocation.CENTRAL,
    'kansas': USLocation.CENTRAL, 'kentucky': USLocation.CENTRAL, 'louisiana': USLocation.CENTRAL,
    'michigan': USLocation.CENTRAL, 'minnesota': USLocation.CENTRAL, 'mississippi': USLocation.CENTRAL,
    'missouri': USLocation.CENTRAL, 'nebraska': USLocation.CENTRAL, 'north dakota': USLocation.CENTRAL,
    'ohio': USLocation.CENTRAL, 'oklahoma': USLocation.CENTRAL, 'south dakota': USLocation.CENTRAL,
    'tennessee': USLocation.CENTRAL, 'texas': USLocation.CENTRAL, 'wisconsin': USLocation.CENTRAL,
    'austin': USLocation.CENTRAL,

    // East
    'connecticut': USLocation.EAST, 'delaware': USLocation.EAST, 'florida': USLocation.EAST,
    'maine': USLocation.EAST, 'maryland': USLocation.EAST, 'massachusetts': USLocation.EAST,
    'new hampshire': USLocation.EAST, 'new jersey': USLocation.EAST, 'new york': USLocation.EAST,
    'north carolina': USLocation.EAST, 'pennsylvania': USLocation.EAST, 'rhode island': USLocation.EAST,
    'south carolina': USLocation.EAST, 'vermont': USLocation.EAST, 'virginia': USLocation.EAST,
    'west virginia': USLocation.EAST, 'nyc': USLocation.EAST,

    // Remote
    'remote': USLocation.REMOTE
};

export class LocationNormalizer {
    static normalize(raw: string): USLocation {
        const loc = raw.toLowerCase().trim();

        // Exact match via map
        if (REGION_MAP[loc]) return REGION_MAP[loc];

        // Partial match via map keys
        for (const [key, value] of Object.entries(REGION_MAP)) {
            if (loc.includes(key)) return value;
        }

        // State Abbreviations
        if (/\b(ca|wa|or|nv|az|id|mt|wy|ut|co|nm|ak|hi)\b/.test(loc)) return USLocation.WEST;
        if (/\b(ny|ma|pa|nj|ct|ri|vt|nh|me|de|md|va|wv|nc|sc|fl)\b/.test(loc)) return USLocation.EAST;
        if (/\b(tx|il|mi|OH|ga|nc|tn|mo|mn|wi|in|ky|al|la|ok|ks|ar|ia|ms|ne|sd|nd)\b/.test(loc)) return USLocation.CENTRAL;

        // General Fallbacks
        if (loc.includes("united states") || loc.includes("usa") || loc.includes(" us ")) return USLocation.OTHER;

        return USLocation.REJECTED;
    }

    static isAccepted(loc: USLocation): boolean {
        return loc !== USLocation.REJECTED;
    }
}
