
const isTechJob = (title: string): boolean => {
    const t = title.toLowerCase();
    // Simplified version of the actual filter for testing
    const keywords = /\b(backend|back-end|back end|frontend|front-end|front end|fullstack|full-stack|full stack|software engineer|swe|developer|engineer|devops|sre|platform|infrastructure|data scientist|data engineer|ml engineer|machine learning|security engineer|cybersecurity|android|ios|mobile|quality assurance|qa|test engineer|embedded|firmware|cloud|architect)\b/;

    // Exclude certain non-tech roles
    const exclude = /\b(recruiter|hr|talent|sales|marketing|account|lawyer|legal|compliance|finance|accounting|customer|support|office|admin|manager|director|vp|head of|lead (?!engineer|developer|software|tech)|principal (?!engineer|developer|software|tech))\b/;

    // Actually, let's check the real file logic
    return keywords.test(t); // && !exclude.test(t); (simplified)
};

console.log("Backend Engineer III:", isTechJob("Backend Engineer III"));
console.log("Senior Software Engineer:", isTechJob("Senior Software Engineer"));
console.log("Product Manager:", isTechJob("Product Manager"));
console.log("Backend Engineer II (Internal)", isTechJob("Backend Engineer II (Internal)"));
console.log("Platform Engineer", isTechJob("Platform Engineer"));
