const fs = require('fs');
fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true')
  .then(res => res.json())
  .then(data => {
    const firstTwo = data.jobs.slice(0, 2);
    const parsed = firstTwo.map(rawJob => {
        // From infra-parser/index.ts:
        return {
            title: rawJob.title || rawJob.text,
            company: 'GREENHOUSE_STRIPE'.split('_').slice(1).join('_'), // Extracts 'GOOGLE' from 'GREENHOUSE_GOOGLE'
            location: rawJob.location?.name || rawJob.categories?.location || 'Remote',
            url: rawJob.absolute_url || rawJob.hostedUrl,
            description: rawJob.content || rawJob.descriptionPlain || rawJob.description
        };
    });
    console.log(JSON.stringify(parsed, null, 2));
  });
